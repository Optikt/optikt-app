# customers (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

CRUD de clientes con soft-delete/reactivación, búsqueda con ranking de relevancia, alta con prescripción atómica y resolución de cliente inline (usada por ventas/cotizaciones). Plan `customer-gender-age` (done): `gender` y `birthDate` **siempre opcionales**, no bloquean crear venta/presupuesto; en UI solo se muestra edad calculada (`calculateAge`), tolerando null.

## Scope

`components/customers/**`, `routes/(app)/customers/**`, `remote/customers.remote.ts`, `queries/customers.ts`, `queries/customerHistory.ts`, `server/customerReference.ts`, `schemas/customers*`, `schema/customers.ts`.

## Reglas de dominio / invarianzas

**Unicidad y datos opcionales**

- `idNumber` único entre activos: si existe con esa cédula se ofrece **reactivación** en vez de error (`customers.remote.ts:204-218`); duplicado entre activos → `invalid` (`:93-98`).
- Normalización `|| null` de `idNumber/birthDate/gender` en create y update (`:100-105,221-230`) — vacío nunca invalida; preservar esa normalización al ampliar campos.

**Transacciones**

- Cliente + prescripción en **una sola tx** (`:221`); audit fuera de la tx (`:247`).
- Alta inline desde venta/cotización: `resolveCustomerReference` (existe por id / doc no duplicado) fuera de tx y `createInlineCustomer` dentro de la tx del caller (`server/customerReference.ts:24-66`); en quotes la vía es `resolveInlineCustomer` de queries.

**Roles**

- Lectura ADMIN/MANAGER/SELLER; delete/reactivate solo ADMIN (`customers.remote.ts:81,123,147`).

**Historial** (`queries/customerHistory.ts`)

- Ventas + cotizaciones del cliente con resolución de nombre de ítems (snapshotName → producto/lensCatalog/tratamiento/descripción libre) y solo pagos no anulados (`:174-209`).

## Patrones locales

- Búsqueda en memoria con `matchesAllTokens` + `computeRelevanceScore` (`customers.remote.ts:47-63`) — mismo estilo que brands/products.
- Schemas comunes reuso: `PhoneSchema`, `NameSchema`, `ReactivateEntitySchema`.

## Testing

- `remote/customers.int.spec.ts` (integración).
- El plan `customer-gender-age` define los casos esperados en specs de schemas/dates e int specs de createSale/createNewQuote.

## Known gaps / tech debt

- 🟡 `reactivateCustomerForm` y `reactivateCustomer` (command) son código idéntico duplicado (`customers.remote.ts:144-188`) — unificar.
- 🟡 `listCustomers` fetch-all + filtro/orden/paginación en memoria (`:44-71`) — escala con nº de clientes.
- 🟠 `getCustomerHistory` trae **todos** los salePayments y filtra en JS (`customerHistory.ts:163-171`) — el peso crece con la base; mover el filtro a SQL antes de que explote con un cliente recurrente.
