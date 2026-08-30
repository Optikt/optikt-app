---
plan name: purchase-ux-fix
plan description: Fix drawer UX and visual consistency
plan status: done
---

## Idea

Refactor the purchase order detail page to fix three critical UX issues:

1. **Payment drawer opens directly with form** — Currently shows empty state with "Registrar pago" button. Should show form immediately when opened, with payment history below.

2. **Unified layout shell across all states** — DRAFT (ready), CONFIRMED, and CANCELLED should use the same grid layout (main content + aside). Only contextual elements change: header buttons, editable/readonly fields, payment visibility, review progress.

3. **Enhanced payment UX** — Form always visible at top of drawer, payment history table below, real-time Bs preview, clear visual hierarchy.

**Key changes:**

- `PurchaseOrderPaymentsDrawer.svelte`: Remove intermediate empty state. Show form + preview at top, payment history table below. Auto-focus first field when opened.
- `+page.svelte`: Unify layout — both DRAFT+ready and CONFIRMED use same grid structure. Conditional rendering only for: header buttons, payment button visibility, review progress card, editable vs readonly fields.
- `PurchaseOrderBalanceCard.svelte`: Keep as-is (already simplified).
- Add `PurchaseOrderReviewProgressCard.svelte` — extract review progress from ReviewReadyView so it can be shown in the aside for DRAFT+ready state.

**State-specific behavior:**

- DRAFT (not ready): Banner warning, edit button, no payments, no review progress
- DRAFT (ready): Review progress card in aside, confirm button, no payments
- CONFIRMED: Payment button in aside, movements visible, all fields readonly
- CANCELLED: Read-only everything, no actions

## Implementation

- Refactor PurchaseOrderPaymentsDrawer.svelte: Remove the intermediate empty state ({#if !showForm && canManagePayments} block). When drawer opens, always show the payment form at the top. Move payment history table below the form. Add auto-focus to first input field when drawer opens. Improve visual hierarchy: form section with clear title, preview card sticky on right, history table with proper spacing.
- Create PurchaseOrderReviewProgressCard.svelte in detail/ folder: Extract the review progress UI (progress bar, reviewed count, zero price warnings, status message) from PurchaseOrderReviewReadyView. Props: items, reviewStatus, zeroPriceCount. This allows showing review progress in the aside for DRAFT+ready state.
- Refactor +page.svelte layout: Unify the grid structure so both DRAFT+ready and CONFIRMED use the same xl:grid-cols-[minmax(0,1.72fr)_minmax(17rem,0.78fr)] layout. Move PurchaseOrderReviewProgressCard to the aside for DRAFT+ready state. Keep PurchaseOrderDetailsSection, PurchaseOrderItemsTable, PurchaseOrderMovementsSection in main column for all non-draft states. Conditionally show payment button only for CONFIRMED.
- Update PurchaseOrderReviewReadyView.svelte: Remove the review progress section (moved to separate component). Keep only the compact order details, items list with review checkboxes, and payment conditions. This component becomes simpler and focused on the review workflow.
- Add auto-open behavior to drawer: When composerRequest is received (from confirm-and-pay flow), drawer should open with form pre-filled AND show the form immediately (not history). Add $effect to watch composerRequest and set showForm=true when it changes.
- Run pnpm check and pnpm lint to verify no type errors or lint issues. Fix any breaking changes from the refactoring.
- Manual verification: Test all 4 states (DRAFT not ready, DRAFT ready, CONFIRMED, CANCELLED). Verify: (a) drawer opens with form visible immediately, (b) same layout shell across states, (c) only contextual elements change, (d) payment history visible below form, (e) review progress shown in aside for DRAFT+ready.

## Required Specs

<!-- SPECS_START -->

- backup-infra-sec
- public-catalog-arch

<!-- SPECS_END -->
