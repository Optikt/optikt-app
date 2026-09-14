# Spec: dt1-f5-mediano

Scope: feature

# Feature: Splits medianos fase 5 (PR #148)

## Objetivo

`PrescriptionFormFields` 677→51 y `SaleStep2Items` 637→464. Lógica verbatim.

## Alcance — Incluido

- `prescriptions/fields/`: `numericFormat.ts` (configs, sanitize, keydown/input/normalize),
  `prescriptionFieldUtils.ts` (fieldName, issues, badge), `FieldError`, `EyeInput`,
  `MeasurementInput`, `EyeCard`, `HeaderSection`, `DistancesSection`,
  `TreatmentsSection`, `NotesSection`. Snippets → componentes; props estáticas con `$derived`.
- `sales/step2/items/`: `step2Pricing.ts`, `step2Accessories.ts`, `step2Validation.ts`,
  `step2RxCopy.ts` (puros, params explícitos) + `Step2ItemsList` + `Step2ValidationHints`.
  Dinero movido verbatim (sin reordenar operaciones ni redondeos).

## QA

- [ ] Receta: lente ≠ monofocal muestra adición/altura; numérico bloquea letras y normaliza a 0.25; errores visibles
- [ ] Paso 2: quick-add producto+lente, accesorios auto, tratamientos por proveedor, copiar receta, validaciones stock/cantidad, total previo = main

## Gates

`pnpm check` 0/0, `pnpm lint`, `pnpm test:unit` 929, campos 22/22 + fns dinero presentes.
