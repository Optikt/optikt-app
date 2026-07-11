# Spec: sale-wizard-patterns

Scope: feature

# Sale Wizard Redesign — Desktop Layout Patterns

## Scope

Feature spec for the `/sales/new` 3-step wizard refactor, documenting compact layout patterns, component extraction strategy, and desktop-first design standards optimized for 1280x720 (office screen).

---

## Design Philosophy

**Desktop-first**: Sales are rarely created on mobile. Optimize for 1280x720 with sidebar open (w-60). Content area target: ~1000px width, ~720px height.

**Density over decoration**: Reduce chrome, increase content space. Every pixel of header/stepper/action-bar is a pixel taken from the actual form.

**Color for meaning only**: Navy reserved for customer banner and summary totals. Standard cards use surface tones.

---

## Vertical Chrome Budget (1280x720)

| Element               | Current   | Target    | Savings    |
| --------------------- | --------- | --------- | ---------- |
| Navbar                | 64px      | 64px      | 0          |
| Breadcrumb + Title    | 72px      | 28px      | 44px       |
| Stepper               | 100px     | 48px      | 52px       |
| Action bar (sticky)   | 96px      | 56px      | 40px       |
| **Total chrome**      | **332px** | **196px** | **136px**  |
| **Content available** | **388px** | **524px** | **+136px** |

---

## Component Pattern: Compact Stepper

### WizardHeader.svelte

**Changes:**

- Badge size: `h-8 w-8` (was `h-12 w-12`) — 32px circles
- Badge radius: `rounded-lg` (was `rounded-2xl`)
- Badge font: `text-sm` (was `text-base`)
- Labels: inline with badge (`flex-row gap-2`) instead of stacked (`flex-col`)
- Label size: `text-[10px]` (was `text-[11px]`)
- Connectors: `w-8` (was `w-16`), `mt-4` (was `mt-6`)
- Title: `text-xl` (was `text-3xl`)
- Remove breadcrumb — title is sufficient context
- Shadow: remove `shadow-[0_18px_40px...]` on active badge, use simple `bg-brand-navy text-white`

**Layout:**

```
[1] Información ── [2] Productos ── [3] Resumen
```

Single horizontal row, ~48px total height.

---

## Component Pattern: Compact Action Bar

### SaleWizardFloatingActions.svelte

**Changes:**

- Position: `sticky bottom-0` (was `sticky bottom-4`)
- Radius: `rounded-lg` (was `rounded-[1.25rem]`)
- Padding: `px-4 py-2.5` (was `px-5 py-4`)
- Shadow: `shadow-[0_4px_12px_rgba(0,0,0,0.08)]` (was heavy shadow)
- Ring: `ring-1 ring-slate-200/60` (was `ring-1 ring-white/80`)
- Primary button: `px-4 py-2.5` (was `px-6 py-3.5`)
- Summary value: `text-base` (was `text-lg`)
- Summary label: `text-[10px]` (was `text-[12px]`)

**Layout:**

```
[← Atrás] [Cancelar]          Total: $XX.XX    [Continuar →]
```

Single row, ~56px total height.

---

## Component Pattern: Step 1 Horizontal Layout

### SaleStep1Info.svelte

**Eliminated:** Left sidebar (288px fixed width with order number + date + helper card)

**New layout:**

```
┌─────────────────────────────────────────────────┐
│ #0002    [Fecha: 26/06/2026 📅]                 │ ← Compact bar (~48px)
├─────────────────────────────────────────────────┤
│                                                  │
│  Selecciona o registra al cliente               │
│  [V-] [12345678] [Buscar]                       │
│  ┌─────────────────────────────────────┐        │
│  │ Cliente encontrado: Juan Pérez       │        │
│  └─────────────────────────────────────┘        │
│                                                  │
│  Nota de la venta                               │
│  [_________________________________]            │
│  [_________________________________]            │
│                                                  │
└─────────────────────────────────────────────────┘
```

- Order number + date: compact `flex-row` bar at top, `rounded-lg`, `px-4 py-2.5`
- Customer lookup: full width (no inner grid split)
- Notes textarea: full width below customer, `rows={4}` (was `rows={6}`)
- Helper card: removed (redundant with step description)
- All cards: `rounded-xl` (was `rounded-[1.5rem]`/`rounded-[1.75rem]`)

---

## Component Pattern: Step 2 Split Architecture

### Sub-components extracted from SaleStep2Items.svelte (1751 lines)

#### SaleQuickAddSearch.svelte

**Responsibility:** Search input + filter tabs (Todo/Productos/Lentes/Ítem Libre) + dropdown results
**Props:**

```ts
interface Props {
	products: ProductWithRelations[];
	lensItems: LensCatalogItemWithRelations[];
	selectedProductIds: Set<string>;
	onSelect: (option: QuickAddOption) => void;
	onAddFreeItem: () => void;
}
```

**Layout:** Full-width single row — search input (flex-1) + filter tabs (inline) + "Ítem libre" button

#### SaleItemCard.svelte

**Responsibility:** Individual item display with inline editing
**Props:**

```ts
interface Props {
	item: SaleItemRow;
	index: number;
	products: ProductWithRelations[];
	lensItems: LensCatalogItemWithRelations[];
	canEdit: boolean;
	onUpdate: (index: number, updates: Partial<SaleItemRow>) => void;
	onRemove: (index: number) => void;
	onEditPrescription: () => void; // Opens SlideOver for lens items
}
```

**Layout:** Compact card — `rounded-xl px-3 py-3`, product name with `truncate` + `title` tooltip, quantity/price/total in tight grid, lens items show "Fórmula" button

#### SalePrescriptionSlideOver.svelte

**Responsibility:** Prescription form (OD/OI) in a SlideOver drawer
**Props:**

```ts
interface Props {
	open: boolean;
	prescriptionValues: PrescriptionValues;
	customerPrescription: Prescription | null;
	lensItems: SaleItemRow[];
	onUpdate: (values: PrescriptionValues) => void;
	onClose: () => void;
}
```

**Layout:** SlideOver from right (uses existing `SlideOver` component). Contains:

- Eye enable checkboxes (OD/OI)
- PrescriptionInput fields (Esfera, Cilindro, Eje, Adición) — full width in drawer
- Cost breakdown
- Treatments panel

**Trigger:** "Editar fórmula" button on lens items opens the SlideOver

---

## Component Pattern: Step 2 Main Layout

### SaleStep2Items.svelte (refactored)

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ #0002  Juan Pérez (V-12345678)  [Fórmula previa]   │ ← Compact customer bar (~48px)
├─────────────────────────────────────────────────────┤
│ [🔍 Buscar productos, lentes...] [Todo|Prod|Lentes] │ ← QuickAddSearch
├─────────────────────────────────────────────────────┤
│  Ítems: 3  Total: $XX.XX                            │ ← Compact summary inline
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐    │
│  │ Product: Gepa Montura  Q:1  $50.00  [×]    │    │ ← SaleItemCard
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ Lens: Crystal Plus  Q:1  $80.00  [Fórmula] │    │ ← SaleItemCard (lens)
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Changes:**

- Customer banner: compact flex-row bar (~48px, was ~120px navy card)
- Partial total: inline badge in the bar (was separate 2-col navy card)
- Search: full-width single row via SaleQuickAddSearch
- Items: full-width list (was 1.65fr with 22rem prescription column)
- Prescription: accessed via "Fórmula" button → SlideOver (was fixed 352px column)

---

## Component Pattern: Step 3 Compact

### SaleStep3Summary.svelte

**Changes:**

- Card radius: `rounded-xl` (was `rounded-[1.5rem]`/`rounded-[1.75rem]`)
- Card padding: `px-4 py-4` (was `px-6 py-6`)
- Table cell padding: `px-3 py-3` (was `px-6 py-5`)
- Bottom grid: same structure, compact padding
- Total card (navy): `rounded-xl px-4 py-4` (was `rounded-[1.5rem] px-6 py-7`)

---

## Rounded Corners Standardization

| Element        | Current                    | Target              |
| -------------- | -------------------------- | ------------------- |
| Cards          | `rounded-[1.5rem]` (24px)  | `rounded-xl` (12px) |
| Large cards    | `rounded-[1.75rem]` (28px) | `rounded-xl` (12px) |
| Inner cards    | `rounded-[1.25rem]` (20px) | `rounded-lg` (8px)  |
| Stepper badges | `rounded-2xl` (16px)       | `rounded-lg` (8px)  |
| Action bar     | `rounded-[1.25rem]` (20px) | `rounded-lg` (8px)  |
| Buttons        | `rounded-xl` (12px)        | `rounded-lg` (8px)  |

---

## Verification Checklist

- [ ] `pnpm prettier --check .` passes
- [ ] `pnpm eslint` passes
- [ ] `pnpm svelte-check` — 0 errors
- [ ] `pnpm test:unit` — all 715+ tests pass
- [ ] `pnpm build` — successful
- [ ] 1280x720 with sidebar open: stepper ~48px, action bar ~56px, content ~524px
- [ ] Step 1: no sidebar, full-width content, order+date in compact bar
- [ ] Step 2: items full-width, prescription in SlideOver, no fixed 352px column
- [ ] Step 3: compact cards and table padding
- [ ] No rounded corners larger than `rounded-xl` (12px)
- [ ] All new sub-components exported from sales barrel
