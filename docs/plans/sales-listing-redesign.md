---
plan name: sales-listing-redesign
plan description: Responsive sales listing page refactor
plan status: active
---

## Idea
## Context

The `/sales` listing page has the same structural problems that `/purchases` had before its refactor. This plan mirrors the purchases refactor pattern to achieve consistency across listing pages.

**Current state of /sales:**
- Stats cards: 4 inline glass-cards, stacked vertically on mobile (consume entire viewport)
- Filter bar: inline, not collapsible on mobile, `min-w-[220px]` on status select
- SalesTable: 8 columns, NO mobileCard snippet (table unusable on mobile)
- Payment progress: inline in SalesTable (not reusable)
- Page wrapper: `p-6` fixed (not responsive)
- Date format: long ("14 jun. 2026")
- Vendedor: full name only (no avatar)
- Cancel button: inline in actions column

**Target state (matching /purchases post-refactor):**
- Stats cards: extracted to SaleStatsCards.svelte, 2x2 grid mobile vertical stack, 4-col desktop horizontal compact
- Filter bar: extracted to SaleFilterBar.svelte, collapsible mobile (toggle with badge), flex-wrap desktop
- SalesTable: compact columns (px-3, short date), mobileCard snippet added, avatar for vendedor
- Payment progress: extracted to SalePaymentProgress.svelte (reusable in mobile card + detail view)
- Page wrapper: `space-y-4 p-4` responsive
- Cancel button: removed from mobile card (detail view only per user decision)

**NOT in scope:**
- Sorting (orderBy/orderSort) — deferred to future plan (requires backend changes to ListSalesSchema, listSales remote, getAllSales query)
- Sales detail view (/sales/[id]) — separate plan
- Sales flow (/sales/new wizard) — separate plan

## Design Direction

Follow same principles as purchases refactor:
- **Personality**: "Utility & Function" — muted palette, functional density
- **Color for meaning only**: Stats cards use surface tones, color only for status/progress
- **4px grid**: Maintain existing token system
- **Monospace for data**: Order numbers, totals, dates
- **Consistency with purchases**: Same component patterns, same responsive behavior

## Component extraction pattern

Following the purchases pattern:
1. SaleStatsCards.svelte — props: `stats` (SalesStats)
2. SaleFilterBar.svelte — props: filter state + callback handlers (same pattern as PurchaseFilterBar)
3. SalePaymentProgress.svelte — props: `sale` (SaleWithRelations), compact mode for mobile

## Key differences from purchases

- Sales has payment progress bar (purchases has balance display)
- Sales has cancel button with permission check (purchases doesn't)
- Sales uses `PaginatedSales` type with `sales` key (not `items`)
- Sales has 2 toggle filters (shippingPending, freeItem) vs purchases' 2 toggles (pending, overdue)
- Sales has no supplier filter
- Sales has `canManage`/`currentUserId`/`currentUserRole` props for cancel permission

## Implementation
- Extract SalePaymentProgress.svelte from SalesTable inline payment progress bar. Props: sale (SaleWithRelations), compact?: boolean. Render: progress bar (h-1.5) + label (paidLabel). Colors: success (100%), warning (partial), outline (0%). Add to sales barrel export.
- Extract SaleStatsCards.svelte from inline stats in +page.svelte. Implement 2x2 grid mobile vertical stack (icon top, number, label below), 4-col desktop horizontal compact. Props: stats (SalesStats). Stats: monthly (ReceiptText), pending (Clock3), completed (CircleCheck), cancelled (CircleX). Add to sales barrel export.
- Extract SaleFilterBar.svelte from inline filters in +page.svelte. Implement collapsible mobile (search always visible, 'Filtros' toggle with active count badge expands remaining filters), flex-wrap desktop. Props: search, statusFilter, shippingPendingFilter, hasFreeItemFilter, hasActiveFilters, onSearch, onStatusChange, onToggleShippingPending, onToggleFreeItem, onClearFilters. Remove min-w-[220px] from status select. Add to sales barrel export.
- Optimize SalesTable.svelte: reduce cell padding from px-4 py-4 to px-3 py-3, shorten date format to 2-digit (14/06/26), add avatar for vendedor (h-7 w-7 navy circle with initials + full name on lg+), compact customer column (name + idNumber on same line with truncate). Use SalePaymentProgress component in paid column.
- Add mobileCard snippet to SalesTable.svelte: order number + customer name prominent, status badge + payment progress on right, 3-column grid (date, total, vendedor initials). NO cancel button in mobile card (detail view only). Use SalePaymentProgress compact mode. Ensure 44px minimum touch targets. Wrap in <a> or <button> based on viewHref/onView.
- Refactor +page.svelte: replace inline stats with <SaleStatsCards>, replace inline filters with <SaleFilterBar>, update wrapper from p-6 to space-y-4 p-4. Remove unused icon imports. Keep SalesTable props (canManage, currentUserId, currentUserRole) and onRefresh callback. Verify PaginatedSales type compatibility.
- Verify: run pnpm prettier, pnpm eslint, pnpm svelte-check, pnpm test:unit. Test responsive at 412px (mobile), 768px (tablet), 1280x720 (office desktop with sidebar). Verify filter collapse, stats 2x2 grid, mobile card rendering, no horizontal scroll at 1280px.

## Required Specs
<!-- SPECS_START -->
- sales-responsive-patterns
<!-- SPECS_END -->