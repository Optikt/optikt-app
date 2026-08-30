---
plan name: componentize-purchase-detail
plan description: Extract page into components
plan status: done
---

## Idea

The `/purchases/[id]` page is a single 2221-line file that handles the entire purchase order detail lifecycle. We'll extract it into focused components under `src/lib/components/purchases/detail/` and move pure helper functions to `src/lib/utils/purchaseOrderDetail.ts`.

**Components to extract:**

1. `PurchaseOrderDetailHeader.svelte` — Hero header with status badges, PO number, action buttons (Edit, Mark Ready, Confirm, Cancel). Internal state for confirm dropdown.
2. `PurchaseOrderStatusStepper.svelte` — Horizontal stepper (Creada → Preparación/Listo → Confirmar → Recibido). Pure presentational.
3. `PurchaseOrderDraftBanner.svelte` — Draft alert banner. Pure presentational.
4. `PurchaseOrderReviewReadyView.svelte` — The entire draft+readyForReview two-column layout (~360 lines). Internal state for search/filter. Props: purchaseOrder, items, onToggleItemReviewed.
5. `PurchaseOrderDetailsSection.svelte` — Full order details cards (supplier, date, document, BCV rate, source rate, notes). Props: purchaseOrder.
6. `PurchaseOrderItemsTable.svelte` — Full items table with search, filter, review column, lot revert. Internal state for search/filter. Props: purchaseOrder, items, lotsMap, showReviewColumn, onToggleItemReviewed, onRevertLot.
7. `PurchaseOrderMovementsSection.svelte` — Movements list with descriptions. Props: movements, items, lotsMap.
8. `PurchaseOrderValueSummary.svelte` — Dark-themed value summary card (cost, discounts, sale value, profit). Props: purchaseOrder, purchaseSummary.
9. `PurchaseOrderAuditTimeline.svelte` — Audit timeline with classification. Props: auditHistory, purchaseOrder.

**Helpers to extract** to `src/lib/utils/purchaseOrderDetail.ts`:

- `itemDisplayName`, `itemDisplayMeta`, `itemBadgeVariant`
- `lotForItem`, `formatLotCode`, `canRevertLot`
- `purchaseLineTotal`, `purchaseLineTotalVes`, `purchaseLineTotalAlt`
- `formatAltAmount`, `formatVesAmount`, `formatBcvRate`
- `movementItemName`, `movementDescription`
- `classifyAuditEntry`, `PO_STATUS_LABELS`, `AuditEvent` type
- `ItemReviewFilter` type and filter options

**What stays in the page:**

- State coordination (purchaseOrder, items, payments, balance, etc.)
- All action handlers (confirm, cancel, mark ready, toggle review, prices, revert lot)
- Callback handlers (handleFinanceChanged, handleCreditUpdated)
- Modal state and modal components
- `syncFromData()` and derived state that spans sections

**Key design decisions:**

- Filter state (itemSearch, itemReviewFilter) moves INTO each component that needs it — the ReviewReadyView and ItemsTable each manage their own filter state independently.
- Components import helpers from `src/lib/utils/purchaseOrderDetail.ts`.
- The page becomes the orchestrator (~400 lines instead of 2221).
- Barrel export from `src/lib/components/purchases/detail/index.ts`.
- All components follow existing conventions: `$props()` rune, `interface Props {}`, callback props with `on*` prefix, Tailwind CSS only.

## Implementation

- Create `src/lib/utils/purchaseOrderDetail.ts` with pure helper functions: itemDisplayName, itemDisplayMeta, itemBadgeVariant, lotForItem, formatLotCode, canRevertLot, purchaseLineTotal, purchaseLineTotalVes, purchaseLineTotalAlt, formatAltAmount, formatBcvRate, movementItemName, movementDescription, classifyAuditEntry, PO_STATUS_LABELS constant, AuditEvent and ItemReviewFilter types. Export from barrel.
- Create `src/lib/components/purchases/detail/index.ts` barrel file, then extract `PurchaseOrderDetailHeader.svelte` — hero header with status badges, PO number, subtitle, and action buttons (Edit, Mark Ready, Confirm with dropdown, Cancel). Internal `$state` for showConfirmDropdown. Props: purchaseOrder, reviewStatus, itemsCount, isDraft, isReadyForReview, isConfirmed, isCashPurchase, allItemsReviewed, actionLoading, and callback props (onEdit, onMarkReady, onUnmarkReady, onConfirm, onConfirmAndPay, onCancel).
- Extract `PurchaseOrderStatusStepper.svelte` — horizontal 4-step stepper (Creada, Preparación/Listo, Confirmar, Recibido) with active/completed styling. Pure presentational component. Props: isDraft, isReadyForReview.
- Extract `PurchaseOrderDraftBanner.svelte` — warning alert banner shown only for DRAFT + not ready. Pure presentational, no props needed.
- Extract `PurchaseOrderReviewReadyView.svelte` — the full draft+readyForReview two-column layout (compact order details, searchable/filterable compact items list with review checkboxes, payment conditions, balance summary, review progress bar). Internal `$state` for itemSearch and itemReviewFilter. Props: purchaseOrder, items, onToggleItemReviewed.
- Extract `PurchaseOrderDetailsSection.svelte` — full order details cards grid (supplier, date, document, BCV rate, optional source rate, delivery note, internal notes). Props: purchaseOrder. Imports helpers from utils.
- Extract `PurchaseOrderItemsTable.svelte` — full items table with search bar, review filter toggle, dynamic columns (review status, type, code, article, quantity, unit cost, total, suggested sale price, lot info with revert button). Internal `$state` for itemSearch and itemReviewFilter. Props: purchaseOrder, items, lotsMap, showReviewColumn, onToggleItemReviewed, onRevertLot.
- Extract `PurchaseOrderMovementsSection.svelte` — movements list with badges, descriptions, lot codes, quantity deltas. Props: movements, items, lotsMap. Imports helpers from utils.
- Extract `PurchaseOrderValueSummary.svelte` — dark-themed value summary card (total units, purchase cost, settlement discounts breakdown, estimated sale value, profit margin). Props: purchaseOrder, purchaseSummary (from calculatePurchaseOrderSummary).
- Extract `PurchaseOrderAuditTimeline.svelte` — audit timeline with classification logic (create, status changes, payments, voids). Imports classifyAuditEntry from utils. Props: auditHistory, purchaseOrder.
- Refactor `+page.svelte` — replace all extracted template sections with component tags, update imports to use new components and utils, remove moved helper functions and filter state from page script. Keep orchestrator logic: state init, derived cross-section values, all action handlers, callback handlers, modal state, and modals. Target: ~400 lines total.
- Run `pnpm check` (SvelteKit typecheck) and `pnpm lint` to verify no type errors or lint issues. Fix any breaking changes from the extraction.

## Required Specs

<!-- SPECS_START -->

- backup-infra-sec
- public-catalog-arch
- purchase-detail-components

<!-- SPECS_END -->
