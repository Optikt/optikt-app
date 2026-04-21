# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Docker Deployment

This project uses `@sveltejs/adapter-node` and ships a multi-stage production image.

### Build the image

The build injects a dummy `DATABASE_URL` only during image build so `pnpm build` does not need a real database.

```sh
docker build -t optikt-app .
```

### Publish a new image to Docker Hub

Versioning follows the `version` field in `package.json`.

1. Bump `version` in `package.json` (e.g. `0.1.0` → `0.2.0`).
2. Commit and push to `main`.
3. The workflow at `.github/workflows/docker-build.yml` builds and pushes:
   - `DOCKER_USERNAME/optikt-app:v<package.json version>`
   - `DOCKER_USERNAME/optikt-app:latest`

Required repository secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`.

### Docker Compose example with PostgreSQL

Minimal setup with the app and a Postgres container in the same network:

```yaml
services:
  app:
    image: your-dockerhub-user/optikt-app:latest
    ports:
      - '3000:3000'
    environment:
      ORIGIN: http://localhost:3000
      DATABASE_URL: postgresql://optikt:optikt@db:5432/optikt
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: optikt
      POSTGRES_PASSWORD: optikt
      POSTGRES_DB: optikt
    volumes:
      - optikt-db:/var/lib/postgresql/data

volumes:
  optikt-db:
```

Run it:

```sh
docker compose up -d
```

For production, set `ORIGIN` to the real public URL (e.g. `https://app.example.com`) and use strong credentials for Postgres.

## Bundle Size Analysis & Optimization

This document explains how to measure bundle sizes, understand minification, and make informed decisions about dependencies.

### Quick Commands

```bash
# Build production bundle
pnpm build

# Analyze client bundle size
du -sh .svelte-kit/output/client

# Find largest JS chunks
find .svelte-kit/output/client -name "*.js" -exec du -sh {} \; | sort -h | tail -10

# Check gzipped size of a file
gzip -c <
```
