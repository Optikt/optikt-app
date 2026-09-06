# Spec: sse-singleton-ids

Scope: feature

# SSE Singleton + Connection IDs

## Objetivo

Una sola conexión SSE por tab, rastreable extremo a extremo.

## Cliente (singleton)

- Un `EventSource` global por tab. `initExchangeRatesPolling()` idempotente: si ya existe y `readyState <= 1`, reusar, no crear otro.
- Guard `browser` + guard HMR/StrictMode doble-mount.
- Antes de reconectar: `old.close()`. Reconexión con backoff exponencial + jitter, no `setTimeout` fijo.
- Cleanup en `$effect` return + `pagehide` / `visibilitychange`.
- Cada instancia genera `clientConnectionId` (`crypto.randomUUID()`), persiste en `sessionStorage` para sobrevivir reload y distinguir tab vs retry.

## Servidor (tracking)

- `GET /stream` exige query `?cid=<uuid>`. Si falta, generar uno servidor y devolverlo en primer evento `hello`.
- `listeners: Map<cid, { send, userId, connectedAt, lastPing }>` en vez de `Set` ciego.
- Reconexión con mismo `cid` reemplaza entrada vieja, no suma.
- Logs estructurados: `connect cid=... user=... total=N`, `disconnect cid=... reason=abort|timeout|error total=N`, `emit to N`.
- Timeout inactividad (ej. 90s sin ping/abort) + cap (ej. 500) con `429` + métrica.
- Excluir healthchecks/bots: no contar `User-Agent` Dokploy/kube-probe o HEAD.

## Verificación

- 2 tabs = 2 `cid` distintos, `total=2`.
- Reload misma tab = mismo `cid`, `total` no crece.
- Forzar error API = sin `EventSource` extra.
- Log permite `grep cid=` y trazar connect → emit → disconnect.
