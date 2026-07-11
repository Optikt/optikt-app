# Spec: sales-responsive-patterns

Scope: feature

# Sales Listing Page Redesign — Responsive Component Patterns

## Scope

Feature spec for the `/sales` listing page refactor, documenting the responsive design patterns, component APIs, and breakpoint behavior established in `/purchases` and replicated here.

---

## Responsive Breakpoints

| Breakpoint       | Width       | Behavior                                                                                                    |
| ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| Default (mobile) | <768px      | Stats cards: 2x2 vertical grid. Filter bar: collapsible (toggle). Table: mobile cards.                      |
| `md`             | 768–1023px  | Stats: 2x2 grid. Filter bar: collapsed by default. Table: desktop visible.                                  |
| `lg`             | 1024–1279px | Stats: 4-col horizontal. Filter bar: filters visible inline flex-wrap. Table: desktop, mobile cards hidden. |
| `xl`             | 1280–1535px | Full desktop layout. Vendedor shows name beside avatar.                                                     |
| `2xl`            | 1536px+     | Tasa BCV column (if any) becomes visible.                                                                   |

**Office target:** 1280x720 with sidebar open (w-60). Content area ~1000px. All components must fit at `<xl`.

---

## Component Pattern: Stats Cards

### SaleStatsCards.svelte

**Props:**

```ts
interface SalesStats {
	monthly: number;
	pending: number;
	completed: number;
	cancelled: number;
}
```

**Layout:**

- Mobile default: `grid grid-cols-2 gap-2` — vertical stack per card (icon → number → label)
- Desktop `lg`: `grid-cols-4 gap-4` — horizontal row (icon | number + label)
- Cards: `rounded-lg bg-surface-container-low px-3 py-2` (not glass-card)
- Monthly spend card: `bg-brand-navy text-white` accent
- Icon: `h-4 w-4 lg:h-5 lg:w-5`
- Number: `font-heading text-xl lg:text-xl font-bold`
- Label: `text-[10px] tracking-wide uppercase lg:text-[11px]`

---

## Component Pattern: Filter Bar

### SaleFilterBar.svelte

**Props:**

```ts
interface Props {
	search: string;
	statusFilter: SaleStatus | '';
	shippingPendingFilter: boolean;
	hasFreeItemFilter: boolean;
	hasActiveFilters: boolean;
	onSearch: (value: string) => void;
	onStatusChange: (value: string) => void;
	onToggleShippingPending: () => void;
	onToggleFreeItem: () => void;
	onClearFilters: () => void;
}
```

**Layout:**

- Mobile: search input + filter toggle button + clear button in one row. Filters panel (grid-cols-2) expands below toggle.
- Desktop `lg`: search input + clear in top row, filters as `flex-wrap gap-2` row below.
- Toggle button: `lg:hidden`, shows `SlidersHorizontal` icon + "Filtros" + active count badge.
- Active count badge: only shows if count > 0, `bg-white/25 rounded-full` pill.
- Clear button: always visible, `bg-brand-navy text-white` when filters active.
- Select inputs: `min-w-[8rem] flex-1`, no fixed widths.
- Toggle buttons: "Pendiente" (shipping), "Ítem libre" (free item). Active state: `bg-warning-container` / active toggle class.
- Wrapper: `glass-card min-w-0 bg-surface-container-low p-3 lg:p-4`

---

## Component Pattern: Payment Progress

### SalePaymentProgress.svelte

**Props:**

```ts
interface Props {
	sale: SaleWithRelations;
	compact?: boolean;
}
```

**Layout:**

- Regular: progress bar (h-1.5, rounded-full) + label text below
- Compact: progress bar only (h-1), no label
- Colors: `bg-success` (100%), `bg-warning` (partial), `bg-outline-variant` (0%)
- Label: `font-mono text-[10px] tracking-wider uppercase` with matching color

---

## Component Pattern: Table Row

### SalesTable.svelte (row snippet)

**Columns (8):** # Orden, Cliente, Fecha, Total (USD), Progreso de Pago, Estado, Vendedor, Acciones

**Cell padding:** `px-3 py-3` (was `px-4 py-4`)
**Date format:** `shortDate()` — `DD/MM/YY` (e.g., `14/06/26`) via `formatDateOnly` with 2-digit day/month/year
**Vendedor:** Avatar (h-7 w-7 navy circle, 2-letter initials) + full name `hidden lg:inline` with `truncate`
**Cliente:** Name + `{idNumber}` on single line, truncate
**Payment progress:** Use `<SalePaymentProgress>` component
**Actions:** "Ver" button + CircleX cancel button (only shown if `canCancelSale` passes permission check)

---

## Component Pattern: Mobile Card

### SalesTable.svelte (mobileCard snippet)

**Layout:** Full-width card `rounded-2xl border p-4 shadow-sm` with `<a>` or `<button>` wrapper.

**Content hierarchy:**

1. Top row: order number + customer name (left), status badge (right)
2. 3-column grid: Date, Total, Vendedor initials
3. Payment progress bar (compact mode, no label)

**Excluded:** Cancel button (detail view only per user decision), full customer ID.

**Touch targets:** Minimum 44px height for interactive areas. Natural since card is wrapped in anchor/button.

---

## Page Layout

**Wrapper:** `space-y-4 p-4` (was `p-6`)
**Component order:** PageHeader → SaleStatsCards → SaleFilterBar → SalesTable
**Spacing:** Consistent 16px (space-y-4) between sections

---

## Shared Component Compatibility

These patterns do NOT affect shared components used by other pages:

- `DataGrid.svelte` — already refactored (light header, responsive columns)
- `PageHeader.svelte` — unchanged
- `AppBadge.svelte` / `SaleStatusBadge.svelte` — unchanged
- `Sidebar.svelte` — already improved in purchases refactor

---

## Verification Checklist

- [ ] `pnpm prettier --check .` passes on all changed files
- [ ] `pnpm eslint` passes on all changed files
- [ ] `pnpm svelte-check` — 0 errors
- [ ] `pnpm test:unit` — all existing tests pass
- [ ] 412px mobile: stats 2x2, filters collapsible, mobile cards visible
- [ ] 768px tablet: stats 2x2 or 4-col, filters collapsible, desktop table
- [ ] 1280x720 office: no horizontal scroll, stats 4-col, filters inline flex-wrap, all columns visible
- [ ] 1280x720 sidebar collapsed: same as expanded but more space
- [ ] No emojis, all Lucide icons, no layout shift on hover
