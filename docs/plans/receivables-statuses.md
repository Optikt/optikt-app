---
plan name: receivables-statuses
plan description: Count debt across all sale statuses
plan status: done
---

## Idea
Dashboard "Balance Pendiente Total" and /receivables only include sales with status PENDING, hiding debt from IN_PROGRESS, READY, and COMPLETED sales.

Root cause: both queries hardcode `eq(sales.status, 'PENDING')`:
- src/lib/server/db/queries/dashboard.ts:92 (pendingPayments stat)
- src/lib/server/db/queries/receivables.ts:60 (getReceivables list)

All these sales still carry real debt (total - paidAmountBcvUsd > 0) that must be collectible. COMPLETED sales CAN have debt: setSaleStatus (sales.remote.ts:1255) allows forward transition to COMPLETED with no balance guard (only voidPayment auto-reverts COMPLETED→PENDING when underpaid). So COMPLETED-with-debt is possible and should be included.

Fix: replace the status filter with "not CANCELLED" (or inArray of PENDING/IN_PROGRESS/READY/COMPLETED). The existing `balance > 0` predicate (gt(total - paidAmountBcvUsd, 0)) is the true source of truth — CANCELLED is the only status to exclude. Receivables UI gets a status badge column so users see the sale stage; labels/text updated to reflect multi-status collection.

## Implementation
- Update `getReceivables` in src/lib/server/db/queries/receivables.ts: replace `eq(sales.status, 'PENDING')` with `sql`${sales.status} != 'CANCELLED'`` (or `inArray(sales.status, [PENDING, IN_PROGRESS, READY, COMPLETED])` importing SaleStatus), keeping `gt(total - paidAmountBcvUsd, 0)`. Update the function doc comment (remove 'PENDING sales only' wording).
- Add `status: string` to `ReceivableRow` interface in receivables.ts and map it in the rows.map() so the UI can render the status badge.
- Update dashboard pending-payments query in src/lib/server/db/queries/dashboard.ts:92 with the same non-CANCELLED filter, and fix the '// Pending payments (PENDING sales...)' comment.
- Update the stale doc comments in src/lib/remote/receivables.remote.ts ('Get all receivables (PENDING sales with outstanding balance)').
- Update receivables page (src/routes/(app)/receivables/+page.svelte): add a status column with badge using `getSaleStatusLabel` / `getSaleStatusBadgeColor` from src/lib/shared/enums/salesTypes.ts; rename 'Ventas Pendientes' stat card label to reflect multi-status (e.g. 'Ventas con saldo'); adjust empty-state text if needed.
- Verify: run `pnpm check` (or repo typecheck) and `pnpm build`; manually verify dashboard Balance Pendiente Total and /receivables include IN_PROGRESS/READY/COMPLETED sales with balance > 0 and still exclude CANCELLED.

## Required Specs
<!-- SPECS_START -->
- backup-infra-sec
- public-catalog-arch
- receivables-multi-status
<!-- SPECS_END -->