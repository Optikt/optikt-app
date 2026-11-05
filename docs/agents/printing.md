# printing (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

PDF A4 server-side vía Chromium headless (puppeteer-core + @sparticuz/chromium) que renderiza las páginas `(print)` con las cookies del usuario; **y por separado** el recibo tickera 80mm vía agente local (`optikt-print-agent`, POST HTTP). El visor del cliente (`PDFViewerModal.svelte` → @pdfslick/core) es otro concern.

## Scope

`routes/(print)/**`, `routes/api/pdf/**`, `components/pdf/**`, `remote/printing.remote.ts`, `server/pdf*` (+ `pdf.test.ts`, `pdf.shutdown.fixture.ts`), `schemas/printing*`, `utils/printDocumentItems.*`. Tasa de tickera viva en `shared/tickera*`+`ticketRate*` (mapeadas a `sales`, lógico del documento).

## Reglas de dominio / invarianzas

- ⚠️ **Imprimir venta cancelada prohibido**: HTTP 409 en A4 (`routes/api/pdf/sale/[id]/+server.ts:17`) y tickera (`printing.remote.ts:78`).
- **Singleton de Chromium** (`server/pdf.ts`): `browserPromise` module-level; si `!browser.connected` se relanza; el fallo de launch limpia la promesa (`:12,71-93`). No instanciar otro browser.
- **Shutdown registered-once** (`pdf.ts:147`): flag global `__optiktPdfShutdownRegistered`; handlers SIGINT/SIGTERM **re-emiten la señal** después de cerrar el browser (`:125-141`) — no eliminar el re-emit (rompe el exit code del proceso).
- `generatePdf` reenvía la cookie del request al headless y `emulateMediaType('print')`; `page.close()` en `finally` (`:162-182`).
- ⚠️ **Tasa BCV congelada en tickera**: `resolveTicketRate(sale.snapshotBcvRate, live)` — el snapshot > 0 gana (reimpresiones idénticas); ventas pre-feature (NULL) usan la viva (`printing.remote.ts:82-83`, `shared/ticketRate.ts:12`, plan `tickera-rate-freeze`). No "arreglar" el snapshot NULL a la fecha de hoy.
- ⚠️ **Tokens de cristales**: única fuente de verdad `getPrintItemLabel` en `utils/printDocumentItems.ts`, usada por PDF **y** tickera. **Prohibido duplicar la lógica** en `printing.remote.ts` o `tickera.ts` (`docs/specs/lens-print-tokens.md:32-34`). Orden de sufijos fijo: `Fotocromático` → `AR` → `Blueblock`.
- **Tickera**: POST síncrono al agente con `x-auth-token` (`PRINT_AGENT_TOKEN`), timeout 10s con AbortController; config ausente → `{success:false}` sin throw; mensajes de error amigables ("¿Está encendida la PC?") (`printing.remote.ts:25,136-171`).
- Roles tickera: ADMIN/MANAGER/SELLER; páginas `(print)` con guard `locals.user` → 401.
- Recibo A4 inline con `Cache-Control: no-store` (`routes/api/pdf/sale/[id]/+server.ts:24-32`).

## Patrones locales

- `routes/api/pdf/[entity]/[id]` es thin: valida, compone URL de impresión y delega a `generatePdf` (señala al print route as SSR source).
- Payload/math del tickera puro y testeable en `$lib/shared/tickera.ts`; la remote solo hace guards/IO (`printing.remote.ts:4-6`).
- Labels de pago del tickera propios (`TICKERA_PAYMENT_LABELS`, `:29-39`) — no reutilizar los de UI.
- Fixture inyectable del shutdown (`pdf.shutdown.fixture.ts` + `createPdfShutdownHandler`).

## Testing

- `server/pdf.test.ts`: normalizePdfUrl, shutdown handler (errores tragados, finalize al final, registro único de señales), señales reales SIGTERM/SIGINT cierran antes de exit.
- Specs de tokens: `utils/printDocumentItems.spec.ts`.

## Known gaps / tech debt

- 🟠 `docs/plans/lens-receipt-fix.md` activo (corrección de cristales en PDF) — leerlo antes de tocar labels de impresión.
- 🟡 TODO: la tasa BCV del A4 quizá deba ser congelada por fecha de venta como tickera (`routes/(print)/print/sale/[id]/+page.server.ts:10`).
- 🟡 Tickera fase 1 síncrona (sin cola de impresión).
