# Spec: purchase-detail-components

Scope: feature

# Feature: Componentize Purchase Order Detail Page

## Problem

`src/routes/(app)/purchases/[id]/+page.svelte` is 2221 lines — a single file handling the entire lifecycle of a purchase order (draft, review, confirm, payments, inventory, audit). This makes it hard to read, maintain, and extend.

## Solution

Extract the page into focused components under `src/lib/components/purchases/detail/` and pure helpers under `src/lib/utils/purchaseOrderDetail.ts`. The page becomes an orchestrator (~400 lines).

## Architecture

### New file: `src/lib/utils/purchaseOrderDetail.ts`

Pure functions with no side effects. All domain-agnostic helpers:

- `itemDisplayName(item)` → string
- `itemDisplayMeta(item)` → string
- `itemBadgeVariant(item)` → 'neutral' | 'info'
- `lotForItem(item, lotsMap)` → InventoryLot | null
- `formatLotCode(lotId, lotsMap)` → string
- `canRevertLot(item, lotsMap)` → boolean
- `purchaseLineTotal(item)` → number
- `purchaseLineTotalVes(item)` → number
- `purchaseLineTotalAlt(item)` → number
- `formatAltAmount(amount, sourceCurrency)` → string
- `formatBcvRate(rate)` → string
- `movementItemName(movement, items)` → string
- `movementDescription(movement, items, lotsMap)` → string
- `classifyAuditEntry(entry)` → AuditEvent | null
- `PO_STATUS_LABELS` constant
- `ITEM_REVIEW_FILTER_OPTIONS` constant
- Types: `AuditEvent`, `ItemReviewFilter`

### New folder: `src/lib/components/purchases/detail/`

| Component                              | Lines  | Internal State               | Key Props                                                                                                                       |
| -------------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                             | barrel | —                            | —                                                                                                                               |
| `PurchaseOrderDetailHeader.svelte`     | ~160   | `showConfirmDropdown`        | purchaseOrder, reviewStatus, isDraft, isReadyForReview, isConfirmed, isCashPurchase, allItemsReviewed, actionLoading, callbacks |
| `PurchaseOrderStatusStepper.svelte`    | ~30    | none                         | isDraft, isReadyForReview                                                                                                       |
| `PurchaseOrderDraftBanner.svelte`      | ~20    | none                         | none                                                                                                                            |
| `PurchaseOrderReviewReadyView.svelte`  | ~360   | itemSearch, itemReviewFilter | purchaseOrder, items, onToggleItemReviewed                                                                                      |
| `PurchaseOrderDetailsSection.svelte`   | ~100   | none                         | purchaseOrder                                                                                                                   |
| `PurchaseOrderItemsTable.svelte`       | ~280   | itemSearch, itemReviewFilter | purchaseOrder, items, lotsMap, showReviewColumn, onToggleItemReviewed, onRevertLot                                              |
| `PurchaseOrderMovementsSection.svelte` | ~60    | none                         | movements, items, lotsMap                                                                                                       |
| `PurchaseOrderValueSummary.svelte`     | ~170   | none                         | purchaseOrder, purchaseSummary                                                                                                  |
| `PurchaseOrderAuditTimeline.svelte`    | ~110   | none                         | auditHistory, purchaseOrder                                                                                                     |

### Page after extraction: `+page.svelte`

Remains as orchestrator (~400 lines):

- State init from `data`
- Cross-section derived state (`reviewStatus`, `purchaseSummary`, `settlementDiscount`, etc.)
- All action handlers (confirm, cancel, mark/unmark ready, toggle review, apply prices, revert lot)
- Callback handlers (`handleFinanceChanged`, `handleCreditUpdated`)
- Modal state + modal components (ConfirmModal, PriceSuggestionModal)
- `syncFromData()` helper

## Conventions

- Svelte 5 `$props()` rune with `interface Props {}`
- Callback props prefixed with `on*`, invoked with `?.()`
- `$state()` / `$derived()` / `$derived.by()` for reactive state
- Tailwind CSS only — no `<style>` blocks (except page-level global animations)
- Lucide icons imported individually
- Path aliases: `$lib/...`
- No barrel export needed for detail components (imported directly by page)

## Acceptance Criteria

- [ ] `pnpm check` passes with zero type errors
- [ ] `pnpm lint` passes with zero errors
- [ ] Page renders identically before/after (all states: draft, ready, confirmed, cancelled)
- [ ] All action handlers work (confirm, cancel, mark ready, unmark ready, toggle review, revert lot, apply prices)
- [ ] Filter state works independently in ReviewReadyView and ItemsTable
- [ ] No regressions in payments panel or credit schedule panel integration
- [ ] Original file reduced from 2221 lines to ~400 lines
