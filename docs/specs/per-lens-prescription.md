# Spec: per-lens-prescription

Scope: feature

# Per-Lens Prescription Accordion

## Summary
Replace the global shared `prescriptionValues` state with per-lens prescription data stored directly in each `LensPairEntry`. Add an inline accordion per lens card (matching the "costo interno" pattern) for editing sphere, cylinder, axis, addition, lensType, and doctorName. Remove `SalePrescriptionSlideOver`, `syncPrescription()`, and all global Rx state from both `NewSaleForm` and `NewQuoteForm`.

## Motivation
- Current system forces one shared prescription for all lens items via `prescriptionValues` global state
- `syncPrescription()` copies the shared values into each lens pair in a `$effect`, creating an unnecessary indirection
- The data model (`LensPairEntry.od.prescription`, `.oi.prescription`) already supports per-lens prescriptions — the UX just doesn't expose it
- Users need different prescriptions per lens (different materials, different lens types)
- The SlideOver is disconnected from the lens cards; an accordion is more contextual

## Design Decisions
- **Accordion per lens card**: matches the existing "Costo interno" UX pattern — button with chevron that expands inline
- **Per-lens lensType + doctorName**: each lens pair stores its own `lensType` and `doctorName` in the data model
- **Copy to all lenses**: convenience button in the search area that propagates the first lens Rx to all others
- **Order number removed from banner**: already shown in WizardHeader above, no need to repeat

## Data Model Changes

### LensPairEntry (newSaleTypes.ts)
Add two fields:
```ts
export interface LensPairEntry {
    catalogItemId: string;
    od: LensEyeEntry;
    oi: LensEyeEntry;
    lensType: string;        // NEW — defaults to LensType.MONOFOCAL
    doctorName: string;       // NEW — defaults to ''
}
```

### LensEyeEntry (already exists, no changes)
```ts
export interface LensEyeEntry {
    enabled: boolean;
    prescription: LensOrderedPrescription; // { sphere, cylinder, axis, addition }
}
```

## Files to Modify

### 1. `src/lib/components/sales/newSaleTypes.ts`
- Add `lensType` and `doctorName` to `LensPairEntry`
- Update `createEmptyLensPair()` defaults

### 2. `src/lib/components/sales/SaleStep2Items.svelte`
**Remove:**
- `prescriptionValues` prop and all references (42 occurrences)
- `syncPrescription()` function (lines 551-571)
- `$effect` that re-syncs all lens items when Rx changes (lines 573-594)
- `showPrescriptionSlideOver` state
- `lensTypeSuggestion`, `lensTypeDecisionContext` state (auto-suggestion moves to per-lens)
- `SalePrescriptionSlideOver` import and usage
- `PrescriptionValues` and `PrescriptionFieldErrors` imports
- `allowsDuplicateProductLines`, `keepCatalogLensType`, `useExistingPrescriptionLensType` functions

**Add:**
- `prescriptionOpenFor: string | null` state for accordion toggle
- Per-lens accordion template after OD/OI toggles (inside lens card, same level as treatments)
- Inline OD/OI fields: sphere, cylinder, axis, addition (4 columns)
- LensType selector and doctorName input
- Copy OD→OI button per lens
- Auto-suggest lensType from catalog lens type (set on lens pair when item is added)

### 3. `src/lib/components/sales/NewSaleForm.svelte`
**Remove:**
- `prescriptionValues` state (lines 160-171)
- `rxErrors` derived (line 232-234)
- `hasInvalidPrescription` derived (line 236)
- `requiredEyes` derived (line 230)
- `step2PrescriptionConfirmation` derived (line 180-182)
- Imports: `PrescriptionValues`, `validatePrescriptionFields`, `hasPrescriptionErrors`, `buildStep2PrescriptionConfirmation`, `getRequiredEyes`
- `buildPrescriptionPayload` import and usage in submit (lines 287-292)

**Update:**
- `step2Valid` — remove `!hasInvalidPrescription` check (validation moves to SaleStep2Items)
- Submit: build prescription from per-lens data (aggregate from items)

### 4. `src/lib/components/sales/saleItemHelpers.ts`
**Update:**
- `buildStep2PrescriptionConfirmation` — read `od.prescription` and `oi.prescription` from each `item.lensPair` instead of global `values` parameter
- Signature changes to: `(items: SaleItemRow[], lensItems: LensCatalogItemWithRelations[])` — remove `values` param
- Each lens item's confirmation uses the lensType from `item.lensPair.lensType`

**Add:**
- `validateLensPrescription(item: SaleItemRow): PrescriptionFieldErrors` — validates per-lens prescription fields
- `hasLensPrescriptionErrors(item: SaleItemRow): boolean`

### 5. `src/lib/components/sales/wizardSubmission.ts`
**Update:**
- `buildPrescriptionPayload` — remove or repurpose (no longer builds from global values)
- Per-lens Rx already flows through `buildSaleItemsFromWizard` which reads `item.lensPair.od.prescription` directly — **no changes needed** there
- But `buildPrescriptionPayload` in NewSaleForm submit needs to aggregate from all lens items to create one Prescription record

### 6. `src/lib/components/sales/SalePrescriptionSlideOver.svelte`
- **DELETE** (or archive) — replaced by per-lens accordion

### 7. `src/lib/components/sales/PrescriptionInput.svelte`
- Keep for reference but remove SlideOver integration
- The `compact` prop is already implemented — the accordion will render fields directly without this component

### 8. `src/lib/components/quotes/NewQuoteForm.svelte`
- Same removals as NewSaleForm (prescriptionValues, rxErrors, hasInvalidPrescription, etc.)

### 9. `src/lib/components/sales/SaleStep3Summary.svelte`
- **No changes** — it receives items and renders them, doesn't touch prescription state

### 10. `src/lib/components/sales/PrescriptionValidationModal.svelte`
- **No changes needed** — it receives `Step2PrescriptionConfirmation` which will be built from per-lens data

## UI Layout

### Accordion per lens card (below OD/OI toggles, above treatments):

```
┌─ Lens item card ──────────────────────────────────────┐
│ ÍTEM 1  [Lente]  [5 disp.]                            │
│ Lens Name · Source · Type                              │
│ Cant.  Precio  Total    [🗑]                           │
│                                                        │
│ ┌─ Ojos [✓ OD] [✓ OI] ────────────────────────────┐  │
│ │                                                    │  │
│ ├─ Fórmula ──────────────── $0.00 ──────────── ▶ ──┤  │
│ │   (expanded:)                                      │  │
│ │   Médico: [___________]  [Tipo lente ▼]  [Copiar] │  │
│ │   ┌─ OI ───────────────────────────────────────┐  │  │
│ │   │ Esf [-2.00] Cil [-0.50] Eje [180] Add [+]  │  │  │
│ │   └─────────────────────────────────────────────┘  │  │
│ │   ┌─ OD ───────────────────────────────────────┐  │  │
│ │   │ Esf [-2.00] Cil [-0.50] Eje [180] Add [+]  │  │  │
│ │   └─────────────────────────────────────────────┘  │  │
│ │                                                    │  │
│ ├─ Costo interno ─────── $45.00 ─────────────── ▶ ──┤  │
│ └────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Search bar additions:
- "Copy Rx to all" button (visible when ≥2 lens items exist and first lens has Rx)

## Banner changes
- Remove the `"Fórmula"` button (line 846-849) — replaced by per-lens accordion
- Remove the `Eye` icon from context status badge when no customer prescription exists
- Keep customer prescription indicator when `customerPrescription` is present

## Validation
- Per-lens: if OD/OI is enabled, sphere OR cylinder required, axis required if cylinder non-zero, addition required for non-monofocal
- `getValidationReasons()` checks each lens item's prescription independently
- `step2Valid` is true when all items are valid AND all enabled eyes have valid prescription
- Remove global `hasPrescriptionErrors(rxErrors)` from `step2Valid` — handled per-item

## Copy to all lenses
- Button in search bar row, visible when ≥2 lens items AND first lens pair has any Rx field filled
- Click copies od.prescription, oi.prescription, lensType, and doctorName from first lens item to all other lens items
- Does not affect OD/OI enabled toggles (each lens keeps its own eye selection)

## Edge Cases
- Adding a lens item: `createItemFromQuickAdd` already calls `syncPrescription(item)` — replace with auto-set lensType from catalog + empty Rx
- Removing a lens item: no special handling needed
- Multiple lenses with different catalog lens types: each sets its own lensType independently
- No customer prescription: per-lens fields start empty (no autofill)
- Customer has prescription: autofill still available per lens (triggered by a button in each accordion)

## Script Logic Deletion Summary
| File | Removed | Lines |
|---|---|---|
| SaleStep2Items.svelte | prescriptionValues prop, syncPrescription(), $effect, SlideOver refs, lensType auto-suggestion state | ~100 |
| NewSaleForm.svelte | prescriptionValues state, rxErrors, hasInvalidPrescription, requiredEyes, step2PrescriptionConfirmation deriveds | ~30 |
| NewQuoteForm.svelte | Same removals as NewSaleForm | ~30 |
| SalePrescriptionSlideOver.svelte | Entire file deleted | 118 |
| **Total removed** | | **~278 lines** |
| **Total added (accordion UI)** | | **~120 lines** |
| **Net reduction** | | **~158 lines** |

## Submission Impact
- `buildSaleItemsFromWizard()` already reads per-lens from `item.lensPair.od.prescription` — **works as-is**
- `buildQuoteItemsFromWizard()` same — **works as-is**
- `buildPrescriptionPayload()` currently used in NewSaleForm submit to create a standalone Prescription record — needs to aggregate from all lens items OR create N records (one per lens pair)
- The Prescription record is a customer-level document; aggregating from all lenses means picking the first or combining. **Decision: create one Prescription per lens pair** if the schema supports it, otherwise use the first lens pair's data.

## Tests
- `prescriptionValidation.spec.ts` — `validatePrescriptionFields` tests need updating for per-lens signature
- `saleItemHelpers.spec.ts` — `buildStep2PrescriptionConfirmation` tests need updating for removed `values` param
- `wizardSubmission.spec.ts` — `buildPrescriptionPayload` tests need updating
- All 715 tests must pass after changes