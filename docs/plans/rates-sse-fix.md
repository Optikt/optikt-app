---
plan name: rates-sse-fix
plan description: Stabilize live currency feed
plan status: done
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

## Resolution (2026-10-25)

Causa raíz real (logs prod Oct 23-25 + build local reproducido): **el poller nunca arrancaba en producción**. `startExchangeRatesPoller()` vivía en `src/instrumentation.server.ts`, cuyo import corre en la línea 1 de `build/index.js` — antes de que `Server.init()` ejecute `set_private_env()` (handler.js). `$env/dynamic/private` estaba vacío en ese momento → `isExchangeRatesConfigured()` falso → early-return silencioso. En dev funcionaba por accidente (instrumentation se cargaba en la primera request, después de inicializar env).

Consecuencia: el cache del servidor solo se refrescaba (a) una vez al boot vía el fetch lazy del GET cuando el cache está vacío, y (b) con el botón Refresh manual (force). Clientes y SSE reflejaban fielmente un cache congelado → ventas/pagos con tasas de hace 24-48h.

Fix: el poller arranca desde el hook `init` de `src/hooks.server.ts` (`ServerInit`, corre una vez por boot después de `set_private_env`, en dev y prod). Se eliminó `instrumentation.server.ts`. Cliente: `pagehide` ya no mata SSE+poll para siempre — `pageshow` los revive (bfcache/móvil). Verificado: `node build` con `EXCHANGE_RATES_POLL_INTERVAL_MS=15000` emite `Poller tasas startup ok` + `Poller tasas ok` cada 15s (antes: cero líneas en 40s). Test de wiring en `src/hooks.server.spec.ts`.