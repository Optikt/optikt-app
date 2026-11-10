# prescriptions (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Fórmulas ópticas por cliente (OD/OS: esfera/cilindro/eje/add/altura, DP/NP, tratamientos) con flag `isCurrent` exclusivo por cliente, y **snapshot inmutable** en sale_items/quote_items.

## Scope

`components/prescriptions/**`, `remote/prescriptions.remote.ts`, `schemas/prescriptions*`, `schema/prescriptions.ts`, lógica pura `shared/prescriptionSnapshot*` + `utils/prescription.ts`, rangos comunes `schemas/common/optical.ts`. El editor de receta en venta/cotización vive en `components/documentEditor` (doc `shared`).

## Reglas de dominio / invarianzas

- Lecturas `requireAuth`; crear/actualizar/setCurrent `requireRole(ADMIN, MANAGER, SELLER)`; **eliminar solo ADMIN** (`prescriptions.remote.ts:102,122,142,215,249`).
- ⚠️ **`isCurrent` exclusivo por cliente**: crear o marcar current despersonaliza las hermanas via `unsetCurrentPrescriptions(customerId, excludeId?, tx)` en la **misma tx** del create/update (`:80-86,191-196,226-231`, `queries/customers.ts:322-337` — solo respeta `deletedAt IS NULL`).
- ⚠️ **Normalización 0 → null** al guardar (`normalizeOpticalValue`, `utils/prescription.ts:10-13`): distingue "no medido" de "medido 0"; centralizada en `toPrescriptionInsert` (`:45-71`).
- Validaciones ópticas (`schemas/prescriptions.ts` + `schemas/common/optical.ts`): esfera −30…+30 paso 0.25; cilindro −10…0 (negativo); add 0…+5; eje entero; DP/NP 10-80; altura 10-40; `requireSphereOrCylinder` (≥ 1 de esfera/cilindro por ojo — 0 explícito cuenta, `:44-63`); `requireAxisWhenCylinder` (`:65+`); ADD requerido si `recommendedLensType ≠ MONOFOCAL`; doctor requerido.
- Eliminación: soft-delete vía texto `softDelete('prescription', …, tx)` siempre; falla atrapada como `{success:false}` (`:260-272`).
- **Snapshot** (`schema/sales.ts:155-168`, `schema/quotes.ts:118-130`): sale/quote items con `itemType=LENS_PAIR` copian od/os* + `prescriptionId` — **inmutables tras la venta** (los cambios de la fórmula no retro-activan ventas). Display via `hasPrescriptionSnapshot`/`formatPrescriptionEye` (`shared/prescriptionSnapshot.ts:16-48`).

## Patrones locales

- Form helper puro `prescription-form.ts` (`createPrescriptionFormData` default date=hoy + isCurrent=true; `prescriptionToFormData`).
- Inputs numéricos por campo con `fields/numericFormat.ts` (step/min/max) y secciones EyeCard/Treatments/Distances; specs de edición bajo `customers/[id]/prescriptions/{new,edit}`.

## Testing

- `shared/prescriptionSnapshot.spec.ts`, `components/prescriptions/prescription-form.spec.ts` (forma/idempotencia de conversión).
- Hueco: sin int.spec del remote (ni de exclusividad `isCurrent`).

## Known gaps / tech debt

- 🟡 El update replica el mapping campo por campo en vez de `toPrescriptionInsert` parcial (`prescriptions.remote.ts:153-188`).
- 🟠 Sin int test de exclusividad `isCurrent` (la invariant más importante del dominio).
- 🟡 Barrel `components/prescriptions/index.ts` (consumible, no extendible).
- Nota del plan `customer-gender-age` (done): género/edad viven en `customers`, no acá.
