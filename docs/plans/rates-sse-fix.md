---
plan name: rates-sse-fix
plan description: Stabilize live currency feed
plan status: active
---

## Idea
Optikt-app muestra 44 SSE clients para pocos usuarios y tasas congeladas 38min (BCV 20h). Causas probables: (1) cliente crea EventSource por montaje sin singleton + handler onerror que duplica conexiones sin close previo en src/lib/stores/exchangeRates.svelte.ts:109; (2) servidor cuenta cada GET /stream en Set en memoria sin id/timeout/cap en src/lib/server/exchangeRates/events.ts:8 y src/routes/(app)/api/exchange-rates/stream/+server.ts:5; (3) poller cada 5min falla silencioso — solo logger.error sin emit, sin timeout en fetch, sin log de éxito — entonces lastFetchedAt se congela y los 44 clientes nunca reciben update (src/lib/server/exchangeRates/poller.ts:12, service.ts:165, client.ts:31); (4) sin observabilidad: no hay log de poll OK, ni health visible, ni distinción entre provider is_stale vs fetch fallido. Plan diagnostica primero con logs, luego endurece cliente/servidor, luego observabilidad y verificación.

## Implementation
- Medir causa 44 conexiones: correlacionar logs SSE connect/disconnect con access logs, contar EventSource por tab, confirmar duplicación por onerror en exchangeRates.svelte.ts:109 y remontajes de +layout.svelte:35
- Endurecer cliente SSE a singleton: un solo EventSource global, guard contra doble init en StrictMode/HMR, cerrar anterior antes de reconectar, backoff con jitter, cleanup en $effect onDestroy + pagehide/visibilitychange
- Endurecer endpoint SSE servidor: id de cliente + userId en logs, timeout de inactividad, cap de listeners, cerrar controller en abort/error, no contar healthchecks/bots como clientes
- Arreglar frescura de tasas: timeout+retry en fetchExchangeRatesFromApi, log estructurado de cada ciclo poller (source, ok/fail, lastFetchedAt, lastError), emitir snapshot aunque falle para despertar UI, distinguir provider is_stale de error de red en getExchangeRatesSnapshot
- Añadir observabilidad mínima: endpoint o log de estado (lastFetchedAt, isStale, pollIntervalMs, listeners count), alerta cuando Date.now-lastFetchedAt >= staleThresholdMs, verificar en Dokploy envs EXCHANGE_RATES_*
- Verificar: reproducir con 2 tabs (debe haber 2 listeners, no 4+), forzar error API (no debe duplicar EventSource), matar poller/API y confirmar UI marca stale + se recupera, carga con 50 conexiones no crece memoria/intervalos

## Required Specs
<!-- SPECS_START -->
- dt1-payment-strategy
- dt1-patterns
- dt1-split-protocol
- public-catalog-arch
- sse-singleton-ids
<!-- SPECS_END -->