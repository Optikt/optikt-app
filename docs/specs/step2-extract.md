# Spec: step2-extract

Scope: feature

# Spec: step2-extract

Scope: feature

# Extract Step 2 Components

Refactor `SaleStep2Items.svelte` (1740 lines) by extracting nested sections into standalone reusable components, reducing the main file to ~400 lines of orchestration logic.

## Components to Create

### 1. `Disclosure.svelte` (ui)

Location: `src/lib/components/ui/Disclosure.svelte`

A generic accordion/disclosure component used by all Step 2 accordions.

Props:

- `title: string` — accordion header text
- `icon?: typeof SvelteComponent` — lucide icon
- `open: boolean` ($bindable) — expanded state
- `statusBadge?: string` — "Pendiente" / "Completa" badge
- `summaryValue?: string` — monetary value shown in header
- `children: Snippet` — expanded content

### 2. `LensFormulaAccordion.svelte` (sales)

Location: `src/lib/components/sales/LensFormulaAccordion.svelte`

Prescription form in a table layout (OI first, OD second, 7 columns).

Props:

- `pair: LensPairEntry` ($bindable) — the lens pair data
- `rxErrs: PrescriptionFieldErrors` — validation errors object
- `open: boolean` ($bindable) — accordion state
- `itemId: string` — for unique input IDs

Uses: `IdInput.svelte` (not directly — the doctor/tipo inputs are inline)

### 3. `InternalCostAccordion.svelte` (sales)

Location: `src/lib/components/sales/InternalCostAccordion.svelte`

Editable cost breakdown (base cost, mounting, shipping + pending checkbox).

Props:

- `costOverrides: CostOverrides` ($bindable)
- `shippingCostPending: boolean` ($bindable)
- `eyeCount: number`
- `open: boolean` ($bindable)

### 4. `LensTreatmentSelector.svelte` (sales)

Location: `src/lib/components/sales/LensTreatmentSelector.svelte`

Checkbox list of available treatments with inline price editing.

Props:

- `treatments: SelectedTreatment[]` ($bindable)
- `availableTreatments: SupplierTreatment[]`
- `eyeCount: number`
- `open: boolean` ($bindable)

### 5. `FreeItemFields.svelte` (sales)

Location: `src/lib/components/sales/FreeItemFields.svelte`

Free item form fields (category select, description, cost, optical notes).

Props:

- `freeItem: FreeItemData` ($bindable)

### 6. `SaleStep2ItemCard.svelte` (sales)

Location: `src/lib/components/sales/SaleStep2ItemCard.svelte`

The complete item card — assembles all sub-components.

Props:

- `item: SaleItemRow` ($bindable) — the item data
- `index: number` — position in list
- Callbacks: `onremove`, `recalcSuggestedPrice`
- Reference data: `products`, `lensItems`

### Cleanup

- Delete `PrescriptionInput.svelte` (unused, 415 lines)
- Remove its barrel export from `src/lib/components/sales/index.ts`

## Expected Result

Before: SaleStep2Items.svelte **1740 lines**
After: SaleStep2Items.svelte **~400 lines** + 6 new components
All 715 tests pass, 0 lint/type errors.
