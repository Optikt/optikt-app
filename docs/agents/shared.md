# shared (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc cubre solo el layer cross-cutting.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Código usado por dos o más dominios o por cliente+servidor, sin reglas de negocio exclusivas de un dominio: base UI, documento comercial compartido, primitivas Zod, audit y hooks del framework. Nada acá debe saber de negocio de un solo dominio — si un archivo gana reglas de un solo dominio, se traslada a la lógica pura de ese dominio (ver excepciones de `src/lib/shared/` en root AGENTS.md).

## Scope

- `src/lib/components/ui/**` (102 componentes base), `layout/**`, `commercialDocument/**`, `documentEditor/**`, `branding/**`, `background/**` (nota: `components/forms/**` = login, pertenece a `users`)
- `src/lib/schemas/common/**` (contacts/dates/identity/numbers/optical/pagination) + `schemas/search.ts` + `schemas/index.ts`
- `src/lib/server/audit/**`, `documentTotals.ts`, `treatmentValidation.ts`, `server/db/{index,types,search}.ts`, `server/db/schema/{utils,index}.ts`
- `src/lib/actions/**`, `context/**`, `dates.ts`, `utils/**`, `stores/**`, `types/**`
- `src/hooks.server.ts`, `src/hooks.client.ts`, `src/app.{html,d.ts}`
- Resto de `src/lib/shared/` (enums, `contracts/**`, `tax.ts`, `exchangeRates.ts`, `notifications.ts`, soporte a varios dominios), **excepto** la lógica pura por dominio: `saleTotals*`/`saleItemCosts*`/`tickera*`/`ticketRate*` → `sales`; `purchaseOrder*` → `purchases`; `payments/**` → `payments`; `expenseCalculations*` → `cash`; `prescriptionSnapshot*` → `prescriptions`.

## Reglas de dominio / invarianzas

- **Audit** (`server/audit/auditService.ts`): contexto via `getAuditContext()` (`userId`, `ipAddress`, `userAgent` del evento actual, `:28`). API: `logCreate/logUpdate/logDelete/logRestore/logCustom`. `logUpdate` calcula diff old→new y **no registra si nada cambió** (`hasChanges`, `:89`). `excludeFields` recorta; `includeSnapshot` guarda el estado entero (usar con moderación). Insert directo a `change_history` (`:195`) — **nunca dentro de la transacción** de negocio (regla global del root).
- **`server/documentTotals.ts`**: único lugar que recalcula totales de documento comercial en servidor. No re-implementar aritmética subtotal/descuento/impuesto inline en otro lado.
- **`hooks.server.ts`**: sesión validada por-request (`handleAuth`, `:20`); cookie se borra si la sesión expiró. `ServerInit` arranca el poller de tasas (`:16`) — NO moverlo a import-time (ver comentario: en prod el env dynamic llegaba vacío y las tasas congelaban). `handleValidationError` (`:89`) centraliza la traducción de issues Zod a mensaje humano.
- **`src/lib/dates.ts`**: toda manipulación de fechas pasa por acá (`nowISO()`); no usar `new Date().toISOString()` sueltos ni aritmética de timezone ad-hoc.
- **Schemas primitivos** (`schemas/common/`): cuando el schema de un dominio repite un patrón de una primitiva, componer desde `common/`, no copiar.
- **`components/ui/**`**: los componentes base se importan de `$lib/components/ui/`, nunca se copian a un dominio. `components/index.ts` es barrel legacy: consumible por código existente, no extendible (regla global No Barrels).
- **`commercialDocument/`** es la capa compartida de fila de documento (ventas/cotizaciones): items, qty, descuento. Reglas exclusivas de un dominio van en el doc de ese dominio, no acá.

## Patrones locales

- Unit specs co-ubicadas junto al archivo (`*.spec.ts`), corren con `pnpm test:unit` (project server + client).
- Tests de integración de query fns: `int.spec.ts` co-ubicado, corren contra Postgres real vía `scripts/run-integration-tests.mjs` (`pnpm test:integration`).
- `src/lib/shared/` = frontera client/server: lógica idéntica a ambos lados vive ahí; lo que es solo-cliente va a `utils/`, solo-servidor a `src/lib/server/`.
- Conteo Físico (archivos en shared, reglas del dominio `inventory`): `countLineSaveQueue.ts` = cola de guardado «último valor gana» (un envío por línea, líneas distintas en paralelo, el caller aporta el `Set` in-flight como `$state`); `countSessionPhase.ts` = fases/CTA/stepper + `buildDiffRows`; `inventoryCount.ts` = math del ciclo. Specs co-ubicados.

## Known gaps / tech debt

- 🟡 Barrels legacy además de los listados: `schemas/index.ts`, `remote/index.ts`, `utils/index.ts`, `audit/index.ts` — consumibles, no extendibles; eliminar en futuras limpiezas.
- 🟠 `documentEditor/` (lensEditor, opticalRange) es shared pero pesado de óptica específica de venta/cotización de cristales — candidato a mover al dominio `lenses` a mediano plazo.
- 🟡 Cobertura de tests unitarios de componentes `ui/**` casi nula (solo `EmptyState.svelte.spec.ts`).

## Testing

- `.spec.ts` co-ubicado es el estándar; `.test.ts` existe como legacy (`tax.test.ts`) — no repliques.
- Deliberado que NO todos los dominios tienen `int.spec.ts`: solo query fns con escrituras/lecturas monetarias o de inventario — sigue ese criterio en vez de "todos los archivos".
