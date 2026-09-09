# Spec: dt1-t1-acceptance

Scope: feature

# Feature: Aceptación Fase 3 — Tres Monolitos T1 (EditSaleModal, LensCatalogForm, Count Detail)

Scope: feature
Vinculado a: dt1-t1-split

## Objetivo

Habilitar refactorización segura de 3 archivos >1100 líneas sin cambiar comportamiento visible. El usuario confirmó que EditSaleModal está pendiente de un redesign completo (fuera de scope fase 3) y que Cashea evolucionará a configuración dinámica (cuotas, comisión global, porcentajes) — también fuera de scope. Este spec blinda que la extracción actual no cierre puertas a esos futuros y que no rompa el flujo actual de edición.

## Alcance — Incluido

- **EditSaleModal.svelte → 5 secciones** (header fields, items section, lens panel, addProduct, addFreeItem) + helpers `editSaleDraft.ts` / `editSaleValidation.ts`. Mantener `updateSale(UpdateSaleInput)` intacto; factories `createEmptyLensDraft` / `existingItemToInput` / `buildLensInputFromDraft` sin cambios de firma.
- **LensCatalogForm.svelte → 4 secciones** (identity, selection con pendientes, ranges, pricing preview) + helpers `lensFormRanges.ts` / `lensFormPending.ts` / `lensFormPricing.ts`. Mantener `runValidatedSubmit` y RemoteForm.
- **count/[id]/+page.svelte → 5 secciones** (header, metrics, lines table, edit row, modals) + helper `countAdjustments.ts`. Mantener `upsertCountLine` / `setLineAdjustmentStatus` / `applySession` / `cancelSession`.
- Barrels `index.ts` por cada extracción y tests espejo para helpers puros (límite ≤300 por módulo nuevo, fuente >500 desaparece).
- **Cashea** en esta fase: preservar flag `isCashea` boolean y checkbox `CasheaCheckbox` tal cual. No introducir cuotas ni comisión dinámica; solo asegurar que el helper/estado quede aislado (pricing derivado en `lensFormPricing.ts` / `editSaleDraft.ts`) para que el futuro feature lo extienda sin tocar las secciones extraídas.

## Alcance — Excluido (Tech Debt Anotado, No Bloqueante)

- **Redesign de EditSaleModal (DT21):** UX actual calificada como "no cumple expectativas" — el usuario planea un redesign futuro completo de edición por ítem (descuento individual, precios, notas por línea, edición inline). Fase 3 solo extrae el modal tal cual; DT21 queda como deuda y ventana natural es la fase 3 misma (nota en PLAN.md). No se cambia layout ni se añade edición inline por ítem en esta fase.
- **Cashea dinámico:** cuotas del cliente, porcentajes de comisión Cashea según configuración global, y cálculo de comisión variable. Fase 3 solo mantiene `isCashea` y `livePairPurchasePrice/liveOperationalCost` como derived aislado; no se añade tabla de configuración ni cálculo de cuotas. Dejar el pricing derivado en un helper puro para que el futuro feature lo parametrice.
- Sin migración de imports de consumidores en esta fase (PR propio posterior, verificable con `rg`).

## Criterios de Aceptación (QA Manual)

### EditSaleModal — Smoke

- [ ] Abrir modal desde detalle de venta, editar `saleDate` / `notes` / `discount` / `reasonError` y guardar sin items → `updateSale` ok
- [ ] Lista `activeItems` / `mainItems` / `removedCount` y preview `previewSubtotal/previewTotal` idénticos antes/después
- [ ] Editar lente existente (startLensEdit → handleLensSelect → add/remove treatment → saveLensEdit) y cancelar (cancelLensEdit) sin leak de `editLensTmp`
- [ ] Agregar producto (ItemSelect → handleProductSelect → addNewProduct) y agregar ítem libre (addNewFreeItem) con `freeItemCategory`
- [ ] Cashea: marcar `isCashea`, guardar, recargar — flag persiste y no afecta a otras ventas
- [ ] Validación `validate()` bloquea submit si falta `reason` o lente inválido; descontar no daña `hasChanges`

### LensCatalogForm — Smoke

- [ ] Crear lente nuevo: autoName (`live` fields), selección supplier → filtra tecnologías, material/differentiators
- [ ] Crear pendientes (`handleCreatePendingSupplier/Material/Technology`) y verlos en selects
- [ ] Rangos: `addRange` / `removeRange` / `toggleSphereMode`, inputs por rango con `getRangeInputClass`, validación cilíndrico/eje/adición
- [ ] Pricing vivo: `livePairPurchasePrice`, `liveOperationalCost`, `liveGrossProfit`, `liveMarginPercent`, `totalWithTax` recalculan al cambiar formData/ranges
- [ ] Submit nuevo vs handleCreateResult / handleUpdateResult con validación server (`buildServerRangeValidations` + `toastUnboundNonRangeIssues`) sin regresión

### Count Detail — Smoke

- [ ] Cargar sesión OPEN, filtros `search` / `activeFilter` (`INVENTORY_COUNT_UI_FILTER_LABELS`) y contadores (total/counted/pending/diff/matched)
- [ ] Editar línea inline (startEditing → handleSaveLine → updateLineLocally) y cancelar (stopEditing)
- [ ] Toggle ajuste `toggleAdjustmentCompleted` / `isAdjustmentStatusUpdating` con `updatingAdjustmentLineIds`
- [ ] Aplicar sesión `handleApplySession` y cancelar `handleCancelSession` con `cancelReason`, estado cambia y DataGrid se refresca
- [ ] Contexto `getInventoryCountContext()` sigue proveyendo activeSession sin prop drilling adicional

## Notas para Implementación

- Mantener `onMount(cacheCatalogItems)` y `untrack` tal cual; no introducir contexto nuevo para `catalogCache` en esta fase (prop explícito < 3 niveles).
- `pendingEntities` y `ranges` quedan con `$state` en el orquestador fase 3; su estado interno mueve a sección pero no a helper con estado (evitar singleton con estado).
- Verificación: `pnpm check` 0, `pnpm lint`, `pnpm test` (helpers), `bash scripts/check-file-size.sh` (ningún fuente >500, nuevos ≤300), `rg` cero imports rotos.

## Referencias Futuras (No Implementar Ahora)

- Commission/cuotas Cashea: cuando se implemente, mover `isCashea` + pricing a `src/lib/shared/cashea.ts` (pure) y exponer configuración global vía `src/lib/context/cashea.ts` (Symbol key) para que `LensFormPricingPreview` y `EditSaleLensPanel` la consuman sin prop drilling.
- Redesign edición por ítem: al decomponer `EditSaleModal`, dejar `EditableItem` como discriminated union con `quantity/discount/discountType/notes` por línea para que el futuro inline edit solo añada UI sin remodelar tipos.
