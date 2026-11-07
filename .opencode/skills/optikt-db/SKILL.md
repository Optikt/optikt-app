---
name: Optikt base de datos
description: Patrones de Drizzle y transacciones en Optikt. Usar al escribir queries, migraciones, cambios de schema, joins, índices, o cualquier escritura en base de datos.
---

# Base de datos (Optikt)

Drizzle + PostgreSQL. Schema en `src/lib/server/db/schema/`, migraciones en `drizzle/`, queries en `src/lib/server/db/queries/`.

## Transacciones: el patrón `DbOrTx`

Toda función de query que escribe acepta `executor: DbOrTx = db` (tipo en `src/lib/server/db/types.ts`), para correr suelta **o** dentro de una transacción.

```ts
// Suelta
await addSalePayment(data);

// Dentro de una transacción (rollback si algo falla)
await db.transaction(async (tx) => {
	await submitSalePayment({ ... }, tx);
});
```

Ejemplos reales: `src/lib/server/db/queries/lenses/pending.ts:25`, `src/lib/server/db/queries/inventoryCount/lines.ts:30`, y el caso obligatorio (sin default) en `src/lib/server/payments/salePayments.ts:23`.

### Reglas

1. Todas las escrituras relacionadas de un `command` van dentro de **un** `db.transaction()`.
2. Propaga `tx` a cada query llamada dentro.
3. Las lecturas de validación (`findSaleById`, etc.) pueden quedar **fuera** de la transacción.
4. El **audit log va después** del commit, nunca dentro.
5. Nunca dupliques la lógica de una query inline: llama a la query con `tx`.

Referencia completa: `src/lib/remote/sales/payments.remote.ts` → `addSalePaymentCore` → `src/lib/server/sales/addSalePayment.ts`.
Transacciones directas en remotes: `src/lib/remote/products.remote.ts:138`, `customers.remote.ts:130`, `purchaseOrders/finance.remote.ts:51`.

## Migraciones

- `drizzle.config.ts` → `schema: './src/lib/server/db/schema'`, dialect `postgresql`, `strict: true`.
- Numeradas en `drizzle/` + snapshot y journal en `drizzle/meta/` (los tres se commitean juntos).
- `pnpm db:generate` (crear) · `pnpm db:push` (aplicar directo, **sin historial**) · `pnpm db:migrate` (aplicar migraciones).

Reglas:

1. **Nunca** edites una migración ya aplicada: genera una nueva.
2. Una migración destructiva (`DROP COLUMN`, `NOT NULL` sin default, cambio de tipo) requiere plan de rollback explícito.
3. `db:push` y `db:migrate` están bajo permiso `ask` en `opencode.json`: no los apliques sin confirmación del usuario.
4. Cambio de schema ⇒ actualiza también los tipos/schemas Zod que lo consumen.

## Organización

- Queries agrupadas por dominio: `queries/sales/`, `queries/purchaseOrders/`, `queries/cash/`, `queries/lenses/`, `queries/inventoryCount/`, `queries/brandAccessories/` y archivos sueltos (`products.ts`, `customers.ts`, `reports.ts`, …).
- `src/lib/server/db/queries/index.ts` es un **barrel legacy** (imports transitivos). Import nuevo ⇒ directo al módulo que lo define, nunca al barrel.
- Evita N+1 en listados: agrega con `join`/`inArray` antes que consultar por fila.

## Prueba mínima

- Unidad pura: `pnpm exec vitest --run --project=server <archivo>`
- Integración (testcontainers `postgres:16`, migra el schema y usa factories): `pnpm test:integration`
  - Harness: `src/lib/testing/remoteHarness.ts`, factories `src/lib/testing/integration/factories.ts`, `resetDb` en `src/lib/testing/integration/db.ts`.

## Checklist

- [ ] ¿Un solo `db.transaction()` para el conjunto de escrituras, con `tx` propagado?
- [ ] ¿El audit log está después del commit?
- [ ] ¿Hay migración nueva (no editada) con snapshot y journal?
- [ ] ¿La migración es reversible o está declarado el plan de rollback?
- [ ] ¿Actualicé los schemas Zod/types que consumen lo que cambié?
- [ ] ¿La prueba usa testcontainers si toca la DB real?
