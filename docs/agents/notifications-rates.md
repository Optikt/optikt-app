# notifications-rates (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Tasas de cambio (BCV/USD/EUR/USDT) con caché in-memory + poller + push SSE a todos los clientes, y sistema de notificaciones in-app dirigidas a roles (stock bajo, backups, tasas stale, tickets).

## Scope

`server/exchangeRates/**` (client, events, health, poller, service), `server/notifications/**`, `routes/(app)/api/exchange-rates/**` (SSE), `remote/exchangeRates.remote.ts` + `notifications.remote.ts`, `stores/exchangeRates.svelte.ts`, `shared/exchangeRates.ts` + `notifications.ts` + `enums/notificationTypes.ts`, `schemas/notifications*`, `queries/notifications.ts`, `schema/notifications.ts`. Docs: `docs/notifications-and-exchange-rates.md`, `docs/specs/sse-singleton-ids.md`.

## Reglas de dominio / invarianzas

**Caché y staleness** (`server/exchangeRates/service.ts`)

- Singleton module-level con `refreshPromise` **deduplicada**: refreshes concurrentes reutilizan la promesa salvo `force` (`:161-163`).
- `isStale` = flag del provider OR sin `lastFetchedAt` OR edad ≥ `EXCHANGE_RATES_STALE_THRESHOLD_MS` (default 30min; poll cada 5min) (`:111-132`).
- Notificaciones solo en **transiciones** `became_stale`/`recovered` (flag `lastKnownRatesWereStale`, `health.ts:27-43`) con dedup por ventana (window = max(staleThreshold, 2×poll), `notifications/service.ts:121-131`).
- Poller arranca desde `hooks.server.ts → init` (motivo del bug histórico en el comentario) — no moverlo a import-time.
- Provider: URL + Bearer key desde env, `AbortSignal.timeout(15s)`, respuesta validada con Zod, redondeo 2 decimales (`client.ts:24-45`, `service.ts:35-37`).

**SSE** (`routes/(app)/api/exchange-rates/stream/+server.ts`, `exchangeRates/events.ts`)

- 401 sin sesión; emite `event: hello` (cid + snapshot inicial) de inmediato; heartbeat cada 30s como comment; cleanup en `abort` no puede duplicar close (`:18-45`).
- Server listeners: `Map<cid, {send,userId,connectedAt}>`; **unsubscribe solo borra si `send` coincide** (evita que una reconexión borre la entrada nueva, `events.ts:25-31`); error en send → listener eliminado (`:43-48`); mismo cid reemplaza la entrada (`docs/specs/sse-singleton-ids.md:23`).
- Cliente (`stores/exchangeRates.svelte.ts`): **singleton de EventSource por tab** con cid en `sessionStorage`; reconexión con backoff cap 30s + jitter; poll HTTP fallback 60s; el snapshot con `lastFetchedAt` igual se descarta (`:16-21`).
- Force-refresh manual desde remote: asegura snapshot y **emite SSE** después (`remote/exchangeRates.remote.ts:51-61,73-84`).

**Notificaciones**

- `publishNotification` es **best-effort**: nunca lanza, loggea y devuelve null (`notifications/service.ts:25-46`) — los flujos de negocio no deben romperse por una notificación.
- `targetRoles` siempre explícito; links a rutas del app; creación SOLO vía helpers del service (no inserts directos, salvo tickets — ver doc `support`).
- Views: cada usuario lee/marca sus propias notificaciones (`remote/notifications.remote.ts:13-33`).

## Testing

- `server/exchangeRates/health.spec.ts` (transiciones stale/recovered).
- Verificación del SSE singleton: checklist manual en `docs/specs/sse-singleton-ids.md` (2 tabs = 2 cid, reload no crece).

## Known gaps / tech debt

- 🟠 Deuda del spec `sse-singleton-ids` pendiente: timeout de inactividad + cap 500 listeners con 429 y exclusión de healthchecks/bots por User-Agent (`sse-singleton-ids.md:25-26`).
- 🟡 Listeners sin tracking de `lastPing` (`events.ts:6-10`) — no hay forma de podar conexiones muertas que no envían abort.
- 🟡 El lazy refresh puede bloquear el primer render de venta si la API de tasas está caída (sale wizard espera snapshot).
