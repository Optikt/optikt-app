---
plan name: per-lens-prescription
plan description: per-lens prescription accordion UX
plan status: active
---

## Idea

Replace the global shared prescriptionValues state with per-lens prescription data stored directly in each lens pair's od/oi data model. Add an inline accordion per lens card (matching the "costo interno" pattern) for editing sphere, cylinder, axis, addition, lensType, and doctorName. Remove SalePrescriptionSlideOver and the syncPrescription function. Add a "copy to all" convenience button.

## Implementation

- Extend LensPairEntry type with lensType and doctorName fields, update createEmptyLensPair() defaults
- Add per-lens prescription accordion UI in SaleStep2Items (OD/OI fields, lensType selector, doctorName, validation errors inline)
- Remove global prescriptionValues from NewSaleForm and NewQuoteForm — remove rxErrors, hasInvalidPrescription, requiredEyes derived state
- Remove syncPrescription() and its $effect from SaleStep2Items, remove prescriptionValues prop
- Update saleItemHelpers: per-lens validatePrescriptionFields, buildStep2PrescriptionConfirmation reads from item.lensPair
- Update wizardSubmission: buildPrescriptionPayload aggregates from all lens items, buildSaleItemsFromWizard already reads per-lens
- Remove SalePrescriptionSlideOver usage and the 'Fórmula' button in the banner
- Add 'copy to all lenses' button in search area to propagate first lens Rx to all others
- Update PrescriptionValidationModal compatibility (already reads Step2PrescriptionConfirmation, no changes needed)
- Run lint, typecheck, and all 715 tests to verify

## Required Specs

<!-- SPECS_START -->

- per-lens-prescription
<!-- SPECS_END -->
