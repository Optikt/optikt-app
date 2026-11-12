# dashboard (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Home con stats del día, ventas recientes, bajo stock, FREE_ITEMs pendientes de enriquecer y vencimientos de compras.

## Scope

`components/dashboard/**`, `routes/(app)/dashboard/**`, `queries/dashboard.ts`.

## Reglas de dominio / invarianzas

- Todos los filtros incluyen `deletedAt IS NULL` y `status != 'CANCELLED'`.
- Bajo stock: productos `stock <= minStock`; cristales **solo** `inventoryMode='STOCK'` con `stock <= 0` (`queries/dashboard.ts:104-121`) — no marcar lentes ON_DEMAND como faltantes.
- `saleDate` de ventas recientes es **alias de `createdAt`** (`dashboard.ts:28-35`) — mantener el convention fecha-verdad del doc `sales`.
- Widget de vencimientos de compras (`getUpcomingPurchaseOrderDues`) es admin-only; el load lo condiciona con `isAdminRole` (`+page.server.ts:13,20-22`).
- "Pagos pendientes" (count + amount) usa el umbral de dominio **`SALE_PAID_EPSILON` = 0.01** de `shared/saleBalance.ts` (`dashboard.ts:87-101`), alineado con `/receivables` y el listado de ventas — antes era `> 0`.

## Patrones locales

- Todas las stats en **un solo load paralelo** (`Promise.all` de 5 queries, `dashboard.ts:51-139`); agregar acá = agregar al Promise.all, no un load secuencial aparte.
- Widgets en `components/dashboard/` puramente presentacionales; la página deriva con `$derived` desde el server data.

## Testing

- Hueco total: ni `dashboard.ts` ni componentes tienen spec.

## Known gaps / tech debt

- 🟡 `r.customerLastName!` non-null assertion (`dashboard.ts:168,271`).
- 🟡 `pendingQuotes` cuenta DRAFT de todos los tiempos, sin filtro temporal.
- 🟡 Scans por `createdAt` sin índice específico (`dashboard.ts`) — medir antes de agregar índices (los índices se deciden en migraciones, no en código).
