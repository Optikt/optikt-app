---
plan name: step2-extract
plan description: extract step2 components
plan status: done
---

## Idea

Refactor SaleStep2Items.svelte (1740 lines) into smaller, reusable components. Extract a Disclosure base component for accordions, then create SaleStep2ItemCard, LensFormulaAccordion, InternalCostAccordion, LensTreatmentSelector, and FreeItemFields. Delete the unused PrescriptionInput.svelte. The main file should go from 1740 lines to ~400 lines of orchestration logic only.

## Implementation

- Create Disclosure.svelte base UI component (accordion pattern reused 3x)
- Create LensFormulaAccordion.svelte — extract prescription table + doctor/tipo + copy button (~300 lines)
- Create InternalCostAccordion.svelte — extract cost edit fields (~85 lines)
- Create LensTreatmentSelector.svelte — extract treatments checkbox list (~75 lines)
- Create FreeItemFields.svelte — extract free item form fields (~55 lines)
- Create SaleStep2ItemCard.svelte — assemble ItemHeader + ItemControls + lens-specific sub-components (~730 lines extracted)
- Wire all new components into SaleStep2Items.svelte, verify 0 errors, 715 tests pass
- Delete PrescriptionInput.svelte and its barrel export

## Required Specs

<!-- SPECS_START -->

- public-catalog-arch
- step2-extract
<!-- SPECS_END -->
