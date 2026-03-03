# Tailscale Preview — Run the built adapter-node server via Tailscale

TL;DR

- Run the built Node server (the adapter-node output under `build/`) and expose its port through Tailscale. Do NOT use `vite preview` for this — run the built server with `node build` so adapter-node reads proxy headers and `ORIGIN` correctly.

Quick test commands

```bash
# build
pnpm build

# run the built node server (example using port 3000)
PORT=3000 NODE_ENV=production sh -lc '. ./.env && node build'

# on another Tailnet machine, reach the host using its Tailnet IP
# curl http://<TAILSCALE_IP>:3000/
```

What this doc covers

- Why `vite preview` is insufficient for Tailscale preview
- How to run the built `adapter-node` server behind Tailscale
- Example `.env` entries and recommended env variables
- Debugging tips and security notes

Why you must run the built server

- `vite dev` and `vite preview` are development preview servers and do not behave like the production `adapter-node` server. In particular they don't read the adapter environment variables and forwarded headers SvelteKit expects (ORIGIN / x-forwarded-\*), which breaks remote functions CSRF checks.

Commands — step by step

1. Ensure Tailscale is installed and up on the host

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscaled &>/dev/null &
sudo tailscale up
# (optional) sudo tailscale up --authkey "${TS_AUTHKEY}"
```

2. Build the app

```bash
pnpm build
```

3. Ensure your `.env` contains the required values (or export them inline)

Example `.env` entries (edit values for your environment):

```ini
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://optikt:password@127.0.0.1:5432/optikt_db
SESSION_SECRET=replace-with-strong-secret
ORIGIN=https://nanezx-elitebook.taild8f0b9.ts.net
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
ALLOWED_HOSTS=nanezx-elitebook.taild8f0b9.ts.net,elitebook.taild8f0b9.ts.net
```

4. Run the built server (loads `.env` then starts the node build)

```bash
sh -lc '. ./.env && node build'
# or override a value inline:
PORT=4173 sh -lc '. ./.env && node build'
```

5. Point Tailscale to the same port

```bash
# if you used PORT=3000
sudo tailscale serve 3000
```

Debugging tips

- Check what the server receives: use app logs or add a temporary log in `src/hooks.server.ts` to print `event.request.headers` and `event.url` for `/_app/remote/*` requests.
- Confirm the forwarded headers from Tailscale:
  - `x-forwarded-proto: https` (so adapter-node reconstructs `https://`)
  - `x-forwarded-host: <your-host>`
- Verify the process is listening: `ss -ltnp | grep :$PORT`
- From another Tailnet machine: `curl -v http://<TAILSCALE_IP>:$PORT/` and inspect response and headers.

Security notes

- Tailscale provides a private network; still protect app endpoints with auth and use strong secrets.
- Use Tailscale ACLs and MagicDNS for fine-grained access and friendly hostnames.
- Prefer running the server as a non-root user and manage it with systemd or a process manager.

Common pitfalls

- Running the server bound to `127.0.0.1` (it must bind to `0.0.0.0`/the port specified by `PORT` for remote Tailnet access).
- Forgetting to set `ORIGIN` or forwarded header names when adapter-node is behind a proxy.
- Using `vite preview` (this will not respect adapter-node environment headers).

References

- SvelteKit adapter-node env vars: https://svelte.dev/docs/kit/adapter-node#Environment-variables-ORIGIN-PROTOCOL_HEADER-HOST_HEADER-and-PORT_HEADER
