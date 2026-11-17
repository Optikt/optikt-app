# Detalle de venta B+ Implementation Plan

---
plan name: detalle-venta-bplus
plan description: Opción B+ del detalle de venta en 6 slices (containers, pagos, stock, historial, móvil, buscador)
plan status: done
---

> **Estado:** DONE — implementado y merged a main vía PR #225 (2026-11-16). Los 22 tasks/casillas quedaron cubiertos en los commits del PR.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la Opción B+ del detalle de venta (6 slices) sin regresiones.

**Architecture:** Slices verticales en una rama: cada slice recorre schema → queries/server → remote → UI → specs → doc-sync, con commit atómico y gates (`pnpm eslint`, `pnpm check`, vitest afectado, `optikt_verify`) en verde antes del siguiente.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes) + Tailwind v4 + Drizzle (Postgres) + Zod + bits-ui + testcontainers (int specs).

**Spec:** `docs/specs/detalle-venta-bplus-design.md` (el plan argumenta desde la spec; los ejecutores leen ambas).

## Global Constraints

- Layer boundaries: UI → remote (`src/lib/remote/`) → queries (`src/lib/server/db/queries/`) → Drizzle; componentes nunca importan `src/lib/server/`; remotes nunca usan Drizzle inline; auditoría best-effort DESPUÉS de la tx.
- Sin cambios a `computeSaleTotals` / impuestos, sin redondeo en cálculo, sin dependencias nuevas, sin `title` nativos (`TriggerTooltip`/`InfoTooltip`).
- `overflow-wrap:anywhere` en textos largos; prohibido `…` salvo donde la spec lo pida.
- Layout de página con container queries (`container-type: inline-size`), nunca viewport queries para el layout.
- Money: `formatPrice` para USD; tasa congelada por pago (`bcvRate`), tolerancia 0.01 en comparaciones de pagado.
- Cada commit incluye doc-sync (`docs/agents/sales.md`, más `inventory.md`/`history.md` si aplica) y respeta el gate de tamaño de archivo (`scripts/check-file-size.sh`).
- Commits: `[optikt-app] ...`, un commit por task, push al final de cada task.

---

## File structure (qué se toca y para qué)

- `src/lib/components/ui/SearchCombobox.svelte` — dropdown desacoplado del trigger (F).
- `src/routes/(app)/sales/[id]/+page.svelte` + `+page.server.ts` — contenedor página, container queries, carga `sale/payments/items/movements/history` (A/D).
- `src/lib/components/sales/detail/SaleDetailHero.svelte` — grid-areas `hl hc2 mon acts hcta` (A/E).
- `src/lib/components/sales/detail/SaleDetailPayments.svelte` — filas sin truncar (B/E).
- `src/lib/components/sales/detail/SalePaymentsHistoryDrawer.svelte` — NUEVO drawer historial pagos (B).
- `src/lib/components/sales/detail/SaleStockDrawer.svelte` — NUEVO (reemplaza `SaleMovementsModal.svelte`) (C).
- `src/lib/server/db/schema/sales.ts` — `sale_payments.createdById/voidedById/voidReason` (B).
- `src/lib/schemas/sales.ts` — `VoidPaymentSchema.reason`, `SaleAuditDiff` types (B/D).
- `src/lib/server/sales/addSalePayment.ts`, `voidSalePayment.ts`, `src/lib/server/db/queries/sales/payments.ts`, `src/lib/server/payments/salePayments.ts`, `src/lib/remote/sales/payments.remote.ts` — quién + motivo (B).
- `src/lib/shared/enums/inventoryTypes.ts`, `src/lib/server/db/schema/inventoryMovements.ts`, `src/lib/server/sales/revertSaleInventory.ts`, `updateSale.ts`, `cancelSale.ts` — `EDIT_REVERT` + origin (C).
- `src/lib/server/sales/saleAuditDiff.ts` — NUEVO puro: `buildSaleAuditDiff(before, after)` (D).
- `src/lib/components/sales/detail/SaleAuditTimeline.svelte`, `SaleAuditHistoryDrawer.svelte`, `SaleAuditEvent.svelte`, `src/lib/utils/saleDetail.ts` — timeline con pagos + diff + ver más (D).
- `drizzle/00XX_*.sql` × 2 migraciones (pagos; la de EDIT_REVERT es solo enum/label en código — si el enum es PG nativo lleva migración, si es varchar no) (B/C).

---

### Task 1: F · Buscador edición legible

**Files:**
- Modify: `src/lib/components/ui/SearchCombobox.svelte:182-186,205-207`
- Test: manual + `pnpm check` (sin spec nueva; cambio CSS puro)

**Interfaces:**
- Consumes: nada nuevo (mismo `SearchCombobox` usado por `ItemSelect.svelte:189-246`).
- Produces: dropdown con ancho propio para todos los consumidores.

- [x] **Step 1: Cambiar clases del dropdown**

```svelte
<!-- resultados:182-186 y vacío/loading:205-207 -->
<!-- antes: class="absolute top-full right-0 left-0 z-50 ..." -->
<!-- después: -->
<div class="absolute top-full left-0 right-auto z-50 w-max min-w-full max-w-[min(32rem,90vw)] ...">
```

- [x] **Step 2: Verificar que ningún ancestro del modal recorta**

Run: `rg -n "overflow-hidden" src/lib/components/sales/editSale/ src/lib/components/sales/EditSaleModal.svelte | head`
Expected: si algún padre recorta la banda del editor, poner `overflow-visible` solo en esa banda.

- [x] **Step 3: Gates y commit**

Run: `pnpm eslint src/lib/components/ui/SearchCombobox.svelte && pnpm check`
Expected: PASS. Luego:

```bash
git add src/lib/components/ui/SearchCombobox.svelte docs/agents/sales.md
git commit -m "[optikt-app] Buscador edición: dropdown ancho independiente del trigger"
```

---

### Task 2: A · Pantallas grandes (containers)

**Files:**
- Modify: `src/routes/(app)/sales/[id]/+page.svelte` (contenedor `.page`: `max-width:1760px`, `container-type:inline-size`)
- Modify: `src/lib/components/sales/detail/SaleDetailHero.svelte` (hijos directos `hl hc2 mon acts hcta` + `grid-template-areas`; 3 zonas ≥1500px; rail 360/420)
- Test: visual manual 1280/1920/2560 + sidebar open/close

**Interfaces:**
- Consumes: mismos datos del loader (sin cambios de datos).
- Produces: layout `.page` con container + hero por áreas que usan B–E.

- [x] **Step 1: Contenedor página**

```css
.page { max-width: 1760px; margin: 0 auto; container-type: inline-size; }
```

- [x] **Step 2: Hero por áreas + rail**

```css
/* base 700–1499 */
.hero { display:grid; grid-template-columns: minmax(0,1fr) 290px;
  grid-template-areas: "hl mon" "hc mon" "acts hcta"; }
@container (min-width: 1500px) {
  .hero { grid-template-columns: minmax(0,1.05fr) minmax(0,1fr) 330px;
    grid-template-areas: "hl hc mon" "acts acts hcta"; }
}
```

Mover panel cliente a hijo `hc2` propio del hero. Rail: `360px` ≥1060, `420px` ≥1500 (container). Barras decorativas a la izquierda de `mon`; ocultas en móvil.

- [x] **Step 3: Gates + commit (incluye doc-sync sales.md)**

Run: `pnpm eslint <archivos> && pnpm check && bash scripts/check-file-size.sh`
Expected: PASS, y a 1280 sin regresión visual.

```bash
git add <archivos> docs/agents/sales.md
git commit -m "[optikt-app] Detalle venta: layout contenedores 1760 + hero 3 zonas"
```

---

### Task 3: B · Pagos (migración + drawer)

**Files:**
- Modify: `src/lib/server/db/schema/sales.ts:282-329` (3 columnas), `drizzle/00XX_*.sql` (nueva migración `pnpm db:generate`)
- Modify: `src/lib/schemas/sales.ts:278-281` (`VoidPaymentSchema` + `reason`), `src/lib/server/db/queries/sales/payments.ts:52-82`, `src/lib/server/sales/addSalePayment.ts`, `voidSalePayment.ts`, `src/lib/server/payments/salePayments.ts`, `src/lib/remote/sales/payments.remote.ts:13-21`
- Modify: `src/lib/components/sales/detail/SaleDetailPayments.svelte` (filas sin truncar)
- Create: `src/lib/components/sales/detail/SalePaymentsHistoryDrawer.svelte`
- Test: `src/lib/server/sales/*payment*.int.spec.ts` (void exige motivo; createdBy/voidBy se guardan)

**Interfaces:**
- Consumes: ctx de usuario en remotes (para `createdById/voidedById`).
- Produces: pagos con `{ createdByName, voidedByName, voidReason }` hacia el drawer.

- [x] **Step 1: Migración**

```ts
// sale_payments +=
createdById: uuid('created_by_id').references(() => users.id),
voidedById: uuid('voided_by_id').references(() => users.id),
voidReason: varchar('void_reason', { length: 500 }),
```

Run: `pnpm db:generate` y revisar el SQL generado.

- [x] **Step 2: Servidor (guardar quién + motivo obligatorio)**

```ts
// VoidPaymentSchema +=
reason: z.string().trim().min(1, 'El motivo es obligatorio').max(500)
```

`addSalePayment` guarda `createdById`; `voidSalePayment` guarda `voidedById/voidReason` + mantiene recalcs/estado.

- [x] **Step 3: UI tarjeta + drawer nuevo (franja Total/Cobrado/Saldo + tarjetas por pago; ver spec §3-B)**

- [x] **Step 4: Int specs + gates + commit**

Run: `pnpm exec vitest --run --project=integration src/lib/server/sales/ | tail -3`
Expected: PASS.

```bash
git add <todo lo del slice> docs/agents/sales.md
git commit -m "[optikt-app] Pagos venta: quién+motivo y drawer historial"
```

---

### Task 4: C · Stock (EDIT_REVERT + drawer)

**Files:**
- Modify: `src/lib/shared/enums/inventoryTypes.ts:10-36` (`EDIT_REVERT` + label «Reversión por edición»)
- Modify: `src/lib/server/sales/revertSaleInventory.ts:45-58` (`origin: 'edit'|'cancel'`), `updateSale.ts:172` (pasa `'edit'`), `cancelSale.ts:45` (pasa `'cancel'`)
- Create: `src/lib/components/sales/detail/SaleStockDrawer.svelte` (reemplaza uso de `SaleMovementsModal.svelte`)
- Modify: `src/routes/(app)/sales/[id]/+page.svelte` (abrir drawer)
- Test: unit de agrupación (usuario+minuto) + neto por producto; int: edición escribe `EDIT_REVERT`, cancelación `CANCEL_REVERT`

**Interfaces:**
- Consumes: movimientos existentes (`referenceType SALE + referenceId`).
- Produces: grupos `{ key, title, entries[] }` + resumen neto para el drawer.

- [x] **Step 1: Tipo + origin (sin migración de datos)**

```ts
// revertSaleInventory.ts
export async function revertSaleInventory(tx, saleId, opts?: { origin?: 'edit' | 'cancel' }) {
  const movementType = opts?.origin === 'edit' ? 'EDIT_REVERT' : 'CANCEL_REVERT';
  // + notes con motivo de edición cuando origin === 'edit'
}
```

- [x] **Step 2: Drawer con resumen neto + filtros + grupos (ver spec §3-C)**

- [x] **Step 3: Specs + gates + commit (doc-sync sales.md + inventory.md)**

```bash
git add <slice> docs/agents/sales.md docs/agents/inventory.md
git commit -m "[optikt-app] Stock venta: drawer neto + EDIT_REVERT"
```

---

### Task 5: D · Diff auditoría + historial con pagos

**Files:**
- Create: `src/lib/server/sales/saleAuditDiff.ts` (`buildSaleAuditDiff(before, after): SaleAuditDiff`, tope 50 + `truncated`)
- Modify: `src/lib/server/sales/updateSale.ts:325-332` (anexar `itemsDiff` al evento post-tx)
- Modify: `src/lib/schemas/sales.ts` (tipos `SaleAuditDiff`), `src/lib/utils/saleDetail.ts:41-162` (clasifica `itemsDiff` + eventos `sale_payment`, fallback viejos), `SaleAuditTimeline.svelte`, `SaleAuditHistoryDrawer.svelte` (filtros + ver más con offset), `SaleAuditEvent.svelte` (tarjetas + despliegue)
- Test: unit del diff (add/del/swap/mod, fórmula, tratamiento, descuento, Cashea, totales, tope); int (`updateSale` guarda diff sin alterar totales/inventario); componente (filtros, ver más)

**Interfaces:**
- Consumes: `before` (items leídos en tx) + `data.items` validados; `SaleItemValueSource` para emparejar por `id`.
- Produces: `changes.itemsDiff` que la UI renderiza por secciones.

- [x] **Step 1: Función pura del diff**

```ts
export interface SaleAuditDiff {
  v: 1;
  items: Array<
    | { t: 'add' | 'del'; name: string; qty: number; unitPrice: number; total: number }
    | { t: 'swap'; from: { name: string; total: number }; to: { name: string; total: number } }
    | { t: 'mod'; name: string; fields: Array<{ key: string; label: string; from: string | null; to: string | null }> }
  >;
  header: Array<{ key: string; label: string; from: string | null; to: string | null }>;
  totals: Array<{ label: string; from: number; to: number }>;
  truncated?: number;
}
export function buildSaleAuditDiff(before: SaleItemValueSource[], after: SaleItemValueSource[]): SaleAuditDiff
```

Costos internos: excluir siempre. Tope: 50 cambios, resto en `truncated`.

- [x] **Step 2: Anexar post-tx en `updateSale` (sin tocar la tx)**

- [x] **Step 3: Timeline + drawer (sale + sale_payment, filtros Todos/Ediciones/Estados, ver más, aviso viejos)**

- [x] **Step 4: Specs + gates + commit (doc-sync sales.md + history.md)**

```bash
git add <slice> docs/agents/sales.md docs/agents/history.md
git commit -m "[optikt-app] Historial venta: diff por ítem + pagos en timeline"
```

---

### Task 6: E · Móvil

**Files:**
- Modify: layout app (sidebar overlay), `SaleDetailHero.svelte` (1 col + stepper compacto + dinero 2 col), `+page.svelte` (bottom bar + hoja «Más»), `SaleItemsTable`/rows (tarjetas), drawers/calculadora full-width
- Test: E2E/visual 390×844 (cobrar, estado, imprimir, pagos/historial/stock con una mano; sin overflow-x)

**Interfaces:**
- Consumes: mismos guards y remotes (sin lógica nueva).
- Produces: página móvil completa.

- [x] **Step 1: Sidebar overlay + hero 1 col (spec §3-E)**
- [x] **Step 2: Bottom bar + hoja «Más» con mismos guards**
- [x] **Step 3: Tarjetas de artículos + drawers full-width + 96px libres**
- [x] **Step 4: Gates + commit**

```bash
git add <slice> docs/agents/sales.md
git commit -m "[optikt-app] Detalle venta móvil: bottom bar + hoja Más"
```

---

## Self-Review

- Spec coverage: F→T1, A→T2, B→T3, C→T4, D→T5, E→T6; §10 (no-hacer) en Global Constraints; §9 (pruebas) en cada task; §7 doc-sync en cada commit. Sin gaps.
- Placeholders: ninguno (todos los steps traen archivo:línea, código o comando exacto).
- Type consistency: `SaleAuditDiff` definido una vez en T5 y consumido por UI del mismo task; `origin` literal `'edit'|'cancel'` igual en T4; columnas de pago iguales en schema/migración/servidor/UI (T3).
