---
plan name: sale-wizard-redesign
plan description: Sale wizard desktop layout optimization
plan status: active
---

## Idea

## Context

The sale creation wizard (`/sales/new`) is a 3-step flow (Información → Productos y Lentes → Resumen) that looks terrible on desktop, especially at 1280x720 (office screen). The user explicitly said "se ve pesima" and wants to focus on desktop (sales are rarely created on mobile).

**Root causes:**

1. **Excessive vertical chrome**: Navbar (64px) + breadcrumb (24px) + title text-3xl (48px) + stepper badges h-12 (100px) + floating action bar (96px) = ~332px of chrome on a 720px viewport. Only ~388px left for content.
2. **Fixed widths don't adapt to 1280px**: Step 1 sidebar 288px, Step 2 prescription panel 352px. At 1280px with sidebar open (240px), content area is ~1000px. These fixed widths leave too little for the main content.
3. **Excessive rounded corners**: `rounded-[1.5rem]` (24px), `rounded-[1.75rem]` (28px) make elements feel inflated.
4. **SaleStep2Items.svelte is 1751 lines** — monolithic, hard to maintain.
5. **Redundant information**: Order number shown in sidebar, action bar, and stepper area simultaneously.

## Decisions (confirmed with user)

1. **Stepper**: Ultra compact — badges h-8 w-8, labels inline, ~48px total height
2. **Action bar**: Compact, stuck to bottom — less padding, no excessive rounded corners, ~56px
3. **Prescription panel**: SlideOver drawer (opens from right when a lens is selected) — frees 352px horizontal for items
4. **Step 1 sidebar**: Eliminated — order number + date in a compact horizontal bar at top, full width for customer + notes below
5. **Component split**: Split SaleStep2Items.svelte into sub-components

## Design Direction

Following `.github/instructions/design-ui.instructions.md`:

- **Personality**: "Utility & Function" — density over decoration
- **Rounded corners**: Standardize to `rounded-xl` (12px) max, `rounded-lg` (8px) for smaller elements
- **Typography**: Stepper labels `text-[10px]`, title `text-xl` (was `text-3xl`)
- **Color for meaning only**: Navy only for customer banner and summary, not for every card
- **4px grid**: Maintain existing spacing tokens

## Scope

**Files to modify:**

- `WizardHeader.svelte` — compact stepper
- `SaleWizardFloatingActions.svelte` — compact action bar
- `SaleStep1Info.svelte` — horizontal layout (no sidebar)
- `SaleStep2Items.svelte` — split into sub-components, prescription SlideOver
- `SaleStep3Summary.svelte` — compact rounded corners + padding
- `NewSaleForm.svelte` — wrapper padding adjustments

**New sub-components (from SaleStep2Items split):**

- `SaleQuickAddSearch.svelte` — search input + filter tabs + dropdown results
- `SaleItemCard.svelte` — individual item row/card with inline editing
- `SalePrescriptionSlideOver.svelte` — prescription form (OD/OI) in a SlideOver drawer
- `SaleTreatmentsPanel.svelte` — treatments selection for lens items

**NOT in scope:**

- Mobile responsive for the wizard (user said sales are rarely created on mobile)
- Backend logic changes (validation, submission)
- Step 3 major restructure (only compact rounding/padding)

## Implementation

- Refactor WizardHeader.svelte to ultra-compact stepper: badges from h-12 w-12 to h-8 w-8, labels inline (flex-row) instead of stacked (flex-col), connectors from w-16 to w-8, remove breadcrumb text, reduce title from text-3xl to text-xl. Total stepper height target: ~48px. Update stepBadgeClass and stepLabelClass.
- Refactor SaleWizardFloatingActions.svelte to compact bar: change rounded-[1.25rem] to rounded-lg, reduce padding from px-5 py-4 to px-4 py-2.5, reduce primary button from px-6 py-3.5 to px-4 py-2.5, summary text from text-lg to text-base. Change sticky bottom-4 to sticky bottom-0. Target height: ~56px.
- Refactor SaleStep1Info.svelte: eliminate left sidebar (18rem fixed). New layout: compact horizontal bar at top with order number + date (flex-row, ~56px tall), then full-width section below with customer lookup and notes. Remove helper 'Nota del sistema' card (redundant with step description). Change rounded-[1.75rem] to rounded-xl. Reduce inner padding from px-6 py-6 to px-4 py-4.
- Split SaleStep2Items.svelte: extract SaleQuickAddSearch.svelte (search input + filter tabs Todo/Productos/Lentes + dropdown with product/lens results). Props: products, lensItems, selectedProductIds, onSelect (callback). Keep quick-add state and filtering logic in this component.
- Split SaleStep2Items.svelte: extract SaleItemCard.svelte (individual item display with quantity/price/total editing, expand/collapse for lens details, cost breakdown, remove button). Props: item, index, products, lensItems, canEdit, onUpdate, onRemove. Handle both product and lens item types.
- Split SaleStep2Items.svelte: extract SalePrescriptionSlideOver.svelte using existing SlideOver component from ui/. Contains: OD/OI eye enable checkboxes, PrescriptionInput fields (Esfera, Cilindro, Eje, Adicion), cost breakdown, treatments panel. Opens when a lens item is selected. Props: prescriptionValues, customerPrescription, items (lens items only), onUpdate.
- Refactor SaleStep2Items.svelte main layout: customer banner from 6-col grid to compact flex-row bar (~48px), partial total as inline badge (not full card), search bar full-width single row, items list full-width (no prescription column). Replace xl:grid-cols-[minmax(0,1.65fr)_22rem] with single column. Prescription accessed via 'Editar fórmula' button on lens items that opens SlideOver.
- Compact Step 2 item cards: reduce rounded-[1.5rem] to rounded-xl, padding from px-5 py-4 to px-3 py-3, product names with truncate + title tooltip, quantity/price/total in a tighter grid. Lens items show 'Fórmula' button instead of inline prescription form.
- Refactor SaleStep3Summary.svelte: change rounded-[1.5rem]/rounded-[1.75rem] to rounded-xl, reduce card padding from px-6 py-6 to px-4 py-4, compact the bottom grid (discount + tax/total). Keep table structure but reduce cell padding from px-6 py-5 to px-3 py-3.
- Update NewSaleForm.svelte: reduce page wrapper padding, ensure all 3 steps use consistent space-y-4. Verify SlideOver integration for prescription. Run pnpm lint, svelte-check, test:unit, build to verify no regressions.

## Required Specs

<!-- SPECS_START -->

- sale-wizard-patterns
<!-- SPECS_END -->
