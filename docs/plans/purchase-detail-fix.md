---
plan name: purchase-detail-fix
plan description: Drawer payments + balance redesign
plan status: done
---

## Idea

The confirmed/cancelled states need two major UX improvements:

1. **Payments as a right drawer** — Instead of the inline `PurchaseOrderPaymentsPanel` (922 lines), create a `PurchaseOrderPaymentsDrawer` component that wraps the payment form + history table inside the existing `SlideOver` component. The main page shows a "Registrar pago" button that opens the drawer.

2. **Simplified BalanceCard** — Redesign `PurchaseOrderBalanceCard` to match the mockup: a cleaner card with "Saldo con proveedor" header, due status badge, and a 2x2 grid of 4 metric cards (Total compra, Pagado registrado, Descuento obtenido, Saldo pendiente). Remove the complex exchange variance display from the main view (keep it in the drawer's payment preview).

**New component:** `src/lib/components/purchases/detail/PurchaseOrderPaymentsDrawer.svelte`

- Uses `SlideOver` (size=xl, direction=right)
- Contains: payment form (currency, date, amount, rates, reference, notes), payment preview sidebar, payment history table, void confirmation
- Receives all the same props as the old panel plus `onOpen`/`onClose` callbacks
- The `composerRequest` flow still works (auto-opens drawer with pre-filled amount)

**Modified:** `PurchaseOrderBalanceCard.svelte` — simplified to 4-card grid matching mockup

**Modified:** `+page.svelte` — replace inline `PurchaseOrderPaymentsPanel` with a "Registrar pago" button + `PurchaseOrderPaymentsDrawer`. Only show for CONFIRMED status.

**State-specific visibility:**

- Draft (not ready): No payments section at all
- Draft (ready): No payments section
- Confirmed: BalanceCard + "Registrar pago" button → opens drawer
- Cancelled: BalanceCard visible, no payment button

## Implementation

- Create `PurchaseOrderPaymentsDrawer.svelte` in `src/lib/components/purchases/detail/` — wrap the full payment functionality (form, history table, void modal, overpayment modal, early payment benefit modal) inside a `SlideOver` component. Props mirror the old panel: purchaseOrderId, status, payments, purchaseOrder, earlyPaymentBenefits, pendingBalanceUsd, debtTotalUsd, isFullyPaid, settlementCurrency, composerRequest, onFinanceChanged. Internal state: showForm, loading, currency, amounts, etc. The drawer header shows 'Registrar pago' title with close button. Body contains the payment form + preview + history table.
- Simplify `PurchaseOrderBalanceCard.svelte` — redesign to match the mockup: header with 'Saldo con proveedor' label + due status badge, then a 2x2 grid of 4 rounded cards (Total compra, Pagado registrado, Descuento obtenido, Saldo pendiente). Keep the payment terms footer. Remove the complex exchange variance section (that info lives in the payment drawer preview now). Keep native currency support but simplify the display.
- Update `detail/index.ts` barrel to export `PurchaseOrderPaymentsDrawer`.
- Refactor `+page.svelte` — remove the inline `PurchaseOrderPaymentsPanel` import and usage. Add `showPaymentsDrawer` state. Add a 'Registrar pago' button (visible only for CONFIRMED and not fully paid). Replace the panel with `<PurchaseOrderPaymentsDrawer>` bound to the drawer state. Pass `composerRequest` so the confirm-and-pay flow auto-opens the drawer with pre-filled amount.
- Run `pnpm check` and `pnpm lint` to verify no type errors or lint issues. Fix any breaking changes.
- Manual verification: test all 4 states (draft, ready, confirmed, cancelled). Confirm: (a) draft shows no payment UI, (b) confirmed shows balance card + payment button, (c) clicking button opens right drawer with payment form, (d) composerRequest auto-opens drawer, (e) payment history visible in drawer, (f) void payment works from drawer.

## Required Specs

<!-- SPECS_START -->
<!-- SPECS_END -->
