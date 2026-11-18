# notifications-rates (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Tasas de cambio (BCV/USD/EUR/USDT) con caché in-memory + poller + push SSE a todos los clientes, y sistema de notificaciones in-app dirigidas a roles (stock bajo, backups, tasas stale, tickets).

## Scope

`server/exchangeRates/**` (client, events, health, poller, service), `server/notifications/**`, `routes/(app)/api/exchange-rates/**` (SSE), `remote/exchangeRates.remote.ts` + `notifications.remote.ts`, `stores/exchangeRates.svelte.ts`, `shared/exchangeRates.ts` + `notifications.ts` + `enums/notificationTypes.ts`, `schemas/notifications*`, `queries/notifications.ts`, `schema/notifications.ts`. Docs: `docs/notifications-and-exchange-rates.md`.

## Reglas de dominio / invarianzas

**Caché y staleness** (`server/exchangeRates/service.ts`)

- Singleton module-level con `refreshPromise` **deduplicada**: refreshes concurrentes reutilizan la promesa salvo `force` (`:161-163`).
- `isStale` = flag del provider OR sin `lastFetchedAt` OR edad ≥ `EXCHANGE_RATES_STALE_THRESHOLD_MS` (default 30min; poll cada 5min) (`:111-132`).
- Notificaciones solo en **transiciones** `became_stale`/`recovered` (flag `lastKnownRatesWereStale`, `health.ts:27-43`) con dedup por ventana (window = max(staleThreshold, 2×poll), `notifications/service.ts:121-131`).
- Poller arranca desde `hooks.server.ts → init` (motivo del bug histórico en el comentario) — no moverlo a import-time.
- Provider: URL + Bearer key desde env, `AbortSignal.timeout(15s)`, respuesta validada con Zod, redondeo 2 decimales (`client.ts:24-45`, `service.ts:35-37`).

**SSE** (`routes/(app)/api/exchange-rates/stream/+server.ts`, `exchangeRates/events.ts`)

- 401 sin sesión; emite `event: hello` (cid + snapshot inicial) de inmediato; heartbeat cada 30s como comment; cleanup en `abort` no puede duplicar close (`:18-45`).
- Server listeners: `Map<cid, ListenerEntry>` con `send/close/userId/connectedAt/lastPing`; **unsubscribe solo borra si `send` coincide** (una reconexión same-cid reemplaza la entrada); error en send → listener eliminado y stream cerrado; sweep cada 30s poda idle >90s (`SSE_IDLE_TIMEOUT_MS`); cap 500 con 429 (`events.ts`, spec `events.spec.ts`).
- Cliente (`stores/exchangeRates.svelte.ts`): **singleton de EventSource por tab** con cid en `sessionStorage`; reconexión con backoff cap 30s + jitter; poll HTTP fallback 60s; el snapshot con `lastFetchedAt` igual se descarta (`:16-21`).
- Force-refresh manual desde remote: asegura snapshot y **emite SSE** después (`remote/exchangeRates.remote.ts:51-61,73-84`).

**Notificaciones**

- `publishNotification` es **best-effort**: nunca lanza, loggea y devuelve null (`notifications/service.ts:25-46`) — los flujos de negocio no deben romperse por una notificación.
- `targetRoles` siempre explícito; links a rutas del app; creación SOLO vía helpers del service (no inserts directos, salvo tickets — ver doc `support`).
- Views: cada usuario lee/marca sus propias notificaciones (`remote/notifications.remote.ts:13-33`).

## Testing

- `server/exchangeRates/health.spec.ts` (transiciones stale/recovered).
- Verificación: `events.spec.ts` (replace-on-reconnect, sweep idle, touch sobrevive, prune por throw, cap 500) + checklist manual (2 tabs = 2 cid, reload no crece).

## Known gaps / tech debt

- ~~🟠 Deuda del spec `sse-singleton-ids` pendiente: timeout de inactividad + cap 500 listeners con 429 y exclusión de healthchecks/bots por User-Agent~~ **Resuelto (2026-11-17):** cap `SSE_MAX_LISTENERS=500` con `429` + `Retry-After`, timeout idle `SSE_IDLE_TIMEOUT_MS=90s` con sweep cada 30s (`touchListener` en cada keepalive/emit exitoso), exclusión de probes por User-Agent/HEAD (`PROBE_UA_PATTERN`), y prune de zombies cuando el enqueue del keepalive falla. Tests: `events.spec.ts` (8 casos).
- ~~🟡 Listeners sin tracking de `lastPing` (`events.ts:6-10`)~~ **Resuelto (2026-11-17):** `ListenerEntry.lastPing` + sweep de inactividad en `events.ts`.
- 🟡 El lazy refresh puede bloquear el primer render de venta si la API de tasas está caída (sale wizard espera snapshot).

## Planes completados
- **2026-11 · rates-sse-fix** — SSE de tasas estabilizado: singleton cliente, cid tracking, poller en hooks.server.ts (resuelto 2026-10-25)
