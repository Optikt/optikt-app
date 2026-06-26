---
plan name: purchases-ui-redesign
plan description: Responsive layout and shared components
plan status: active
---

## Idea
## Context

Optik-T is a small optical store's internal management app (SvelteKit + Tailwind v4 + Flowbite-Svelte). The `/purchases` page lists purchase orders with stats cards, filter bar, and a data table. Current problems:

1. **Desktop 1280x720** (office screen): Table has 9 columns requiring horizontal scroll. Filter bar with 8 elements is cramped. Sidebar consumes space.
2. **Mobile 412x924**: Stats cards (4 stacked) consume the entire viewport before table is visible. Filters are inaccessible (only 2 of 8 visible). Table not visible.
3. **Shared components need improvement**: DataGrid header (navy/gold) is heavy and decorative (violates "color for meaning only" principle). Sidebar collapsed state looks broken. Stats + filter bar are inline (duplicated across 6 listing pages).

## Scope

**Primary**: `/purchases` page (`src/routes/(app)/purchases/+page.svelte`)
**Shared (affects all pages)**:
- `DataGrid.svelte` — header refactor (9 pages + 2 manual tables)
- `Sidebar.svelte` — collapsed state improvement (all pages)
- 2 manual tables using `bg-brand-navy` header pattern (`customers/[id]/+page.svelte`, `SaleStep3Summary.svelte`)

**NOT in scope** (per user decision): Extracting StatsGrid/FilterBar shared components for other listing pages (sales, customers, quotes, receivables, products). Only purchases gets extracted components for now — replicate later if successful.

## Design Direction

Following `.github/instructions/design-ui.instructions.md`:
- **Personality**: "Utility & Function" — muted palette, functional density (GitHub-style)
- **Depth strategy**: Surface color shifts (`#fff` on `#f5f3f6` background) — already partially in place
- **Color for meaning only**: Remove decorative navy/gold from table headers. Use surface tones for structure, color only for status badges.
- **4px grid**: Maintain existing token system (`--ds-spacing-*`)
- **Typography**: Keep Space Grotesk (headings) + Inter (body) — already good
- **Monospace for data**: Already using `font-mono` for order numbers, rates, balances

## DataGrid Header Refactor

Current: `bg-brand-navy` + `text-brand-gold uppercase text-[10px] tracking-widest`
New: `bg-surface-container-high` + `text-on-surface-variant font-semibold text-xs` + `border-b border-outline-variant`
Rationale: Aligns with "color for meaning only" and "surface color shifts" depth strategy. Lighter, more professional, less visually heavy. Status badges inside rows retain their colors for meaning.

## Mobile Strategy (from `adapt` skill)

- **Stats cards**: Compact horizontal row on mobile (single-line mini-cards, scrollable or 2x2 grid), full 4-col grid on desktop
- **Filter bar**: Collapsible — search always visible, toggle button expands remaining filters. Full grid on desktop.
- **Table**: Mobile cards (already exist in mobileCard snippet) with improved touch targets (44px min), better information density
- **Touch targets**: All buttons minimum 44x44px on mobile
- **Progressive disclosure**: Table + filters visible first, stats compact above

## Desktop 1280x720 Strategy

- Reduce page padding from `p-6` to `p-4` on smaller screens
- Compact stats cards (reduce icon size, tighter spacing)
- Optimize table columns: shorter date format, avatar-only for "Creado por" with tooltip, compact document column
- Consider hiding low-priority columns (Tasa BCV) on narrow desktop with toggle

## Implementation
- Refactor DataGrid.svelte header: replace bg-brand-navy + text-brand-gold with bg-surface-container-high + text-on-surface-variant + border-b border-outline-variant. Update pagination active button from bg-brand-navy to bg-brand-blue for consistency. This automatically updates all 9 pages using DataGrid.
- Update 2 manual tables that replicate the navy header pattern: src/routes/(app)/customers/[id]/+page.svelte (prescriptions history table) and src/lib/components/sales/SaleStep3Summary.svelte (sale summary table). Match the new DataGrid header style.
- Extract PurchaseStatsCards.svelte component from inline stats in +page.svelte. Implement compact mobile layout: 2x2 grid or horizontal scroll row with mini-cards (icon + number only, label as tooltip). Desktop keeps full 4-column grid with labels. Accept stats data as props.
- Extract PurchaseFilterBar.svelte component from inline filters in +page.svelte. Implement collapsible mobile behavior: search input always visible, 'Filtros' toggle button (with active count badge) expands/collapses remaining filters in a dropdown panel. Desktop keeps full inline grid. Accept filter state and handlers as props/callbacks.
- Optimize PurchaseOrdersTable.svelte for 1280px width: shorten date format (10/06/26 instead of '10 jun. 2026'), make 'Creado por' column avatar-only with full name in tooltip, compact document column (single line with truncation), consider hiding 'Tasa BCV' column below xl breakpoint. Add sticky table header (position: sticky, top: 0) for scrollable contexts.
- Improve mobileCard snippet in PurchaseOrdersTable.svelte: ensure 44px minimum touch targets, improve information hierarchy (order number + supplier prominent, status badges, document/balance in grid), add swipe affordance visual cue. Test at 412px width.
- Improve Sidebar.svelte collapsed state (w-16): center icons horizontally with flexbox, add title attribute tooltips on hover, increase icon size slightly (h-5 w-5), add active state indicator (left border accent), improve divider styling in collapsed mode. Ensure smooth width transition.
- Optimize +page.svelte layout for 1280x720: reduce container padding to p-4 on md screens, compact spacing between sections (space-y-4 instead of space-y-6), ensure all content fits without horizontal scroll at 1280px with sidebar expanded (w-60). Add responsive padding (p-4 md:p-6).
- Verify responsive behavior across breakpoints: 412px (mobile), 768px (tablet), 1280x720 (office desktop with sidebar), 1280x720 with sidebar collapsed. Test filter expansion, stats compact mode, table column visibility. Run pnpm lint and pnpm test to ensure no regressions.

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->