# Spec: step1-customer-patterns

Scope: feature

# Step 1 Customer Lookup UX — Component Patterns

## Scope
Feature spec for the sale wizard Step 1 customer lookup UX improvements, documenting auto-search behavior, compact form layout, and inline validation patterns.

---

## Component: CustomerLookupInput.svelte

### Auto-Search Behavior

**Trigger:** Debounced search 600ms after `idDigits` input stops changing.
**Immediate search:** Enter key triggers search instantly (bypasses debounce).
**Visual feedback:** Spinner icon inside document input while `searching === true`.
**No "Buscar" button:** Removed entirely. Search is automatic.

```ts
let searchTimeout: ReturnType<typeof setTimeout> | undefined;

function handleDigitsInput(e: Event) {
    const input = e.target as HTMLInputElement;
    idDigits = input.value.replace(/\D/g, '').slice(0, 10);
    if (mode !== 'create') clearResolvedState();
    else syncNewCustomer();

    // Auto-search: debounce 600ms
    clearTimeout(searchTimeout);
    if (idDigits.length >= 1) {
        searchTimeout = setTimeout(() => handleSearch(), 600);
    }
}
```

### Layout: Search Row (no "CLIENTE" label)

**Eliminated:** Header row with "CLIENTE" label + "Limpiar" + "Nuevo cliente" buttons (~60px).

**New layout:** Single row with all controls inline:
```
[V ▼] [Documento input + spinner] [+] [×]
```
- Prefix select: `w-16` (narrow)
- Document input: `flex-1` with search icon left, spinner right when searching
- New customer button: `h-10 w-10` icon-only (UserPlus)
- Clear button: `h-10 w-10` icon-only (X) — only visible when `mode !== 'idle'`

### Layout: Creation Form (2-column grid)

**Grid:** `grid grid-cols-2 gap-3`

| Row | Left column | Right column |
|---|---|---|
| 1 | Nombre | Apellido |
| 2 | CI (prefix `w-14` + digits `flex-1`) | Teléfono |
| 3 | Email (full width, `col-span-2`) | — |
| 4 | Dirección textarea (full width, `col-span-2`, `rows={2}`) | — |

**Field styling:**
- Padding: `px-3 py-2.5` (was `px-4 py-3`)
- Radius: `rounded-lg` (was `rounded-xl`)
- Label: `text-[10px]` (was `text-[11px]`)
- Gap between fields: `gap-3` (was `gap-4`)

### Inline Validation (no banner)

**Eliminated:** Bottom banner "Nombre, apellido y documento son requeridos..."

**New:** Per-field inline validation:
- Empty required field (firstName, lastName, idNumber): `ring-1 ring-error/40` border
- Error text below field: `text-[10px] text-error` — "Requerido"
- Validation triggers on blur, not on every keystroke
- Fields clear error when user types

### Compact: "Found" Customer Card

| Element | Current | Target |
|---|---|---|
| Avatar | `h-14 w-14 rounded-2xl` | `h-10 w-10 rounded-lg` |
| Name | `text-xl` | `text-lg` |
| Card padding | `px-5 py-5` | `px-4 py-3` |
| Card radius | `rounded-[1.5rem]` | `rounded-xl` |
| Badge | `px-3 py-1 text-[10px]` | `px-2 py-0.5 text-[9px]` |

### Compact: "Missing" State

| Element | Current | Target |
|---|---|---|
| Icon container | `h-12 w-12 rounded-2xl` | `h-8 w-8 rounded-lg` |
| Card padding | `px-5 py-5` | `px-4 py-3` |
| Card radius | `rounded-[1.5rem]` | `rounded-lg` |
| "Crear" button | `bg-brand-navy` | `bg-brand-gold text-brand-navy` (more prominent) |
| Message | 2 lines | 1 line: "No encontramos V-XXXX. ¿Crear nuevo cliente?" |

---

## Component: SaleStep1Info.svelte

### Notes Card

| Element | Current | Target |
|---|---|---|
| Textarea rows | `rows={4}` | `rows={3}` |
| Card padding | `px-5 py-5` | `px-4 py-3` |
| Description text | Full paragraph | Remove (label is sufficient) |

---

## Rounded Corners Standardization

| Element | Current | Target |
|---|---|---|
| Found card | `rounded-[1.5rem]` | `rounded-xl` (12px) |
| Missing card | `rounded-[1.5rem]` | `rounded-lg` (8px) |
| Avatar | `rounded-2xl` | `rounded-lg` (8px) |
| Field inputs | `rounded-xl` | `rounded-lg` (8px) |
| Buttons | `rounded-xl` | `rounded-lg` (8px) |

---

## Vertical Space Budget (1280x720)

| Element | Current | Target |
|---|---|---|
| "CLIENTE" label row | 60px | 0px (eliminated) |
| Search row | 80px | 48px (compact) |
| Found card | 120px | 80px |
| Missing state | 100px | 56px |
| Creation form | 420px | 240px (2-col grid) |
| Validation banner | 48px | 0px (inline) |
| Notes card | 200px | 120px (3 rows) |
| **Total Step 1** | **~920px** | **~544px** |

At 1280x720 with chrome (~196px after wizard refactor), content area is ~524px. Step 1 at ~544px means minimal scroll — only ~20px overflow, versus ~400px currently.

---

## Verification Checklist

- [ ] `pnpm prettier --check .` passes
- [ ] `pnpm eslint` passes
- [ ] `pnpm svelte-check` — 0 errors
- [ ] `pnpm test:unit` — all tests pass
- [ ] Auto-search triggers 600ms after typing document
- [ ] Enter key triggers immediate search
- [ ] No "Buscar" button visible
- [ ] Creation form uses 2-column grid
- [ ] Inline validation (red borders) on empty required fields
- [ ] No validation banner at bottom
- [ ] "Found" card compact (avatar h-10, rounded-lg)
- [ ] "Missing" state compact with prominent "Crear" button
- [ ] Notes textarea 3 rows
- [ ] All rounded corners ≤ rounded-xl (12px)