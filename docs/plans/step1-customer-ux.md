---
plan name: step1-customer-ux
plan description: Step 1 customer lookup UX improvements
plan status: active
---

## Idea

## Context

The sale wizard Step 1 (customer association/creation) has UX problems that cause excessive scrolling, especially when creating a new customer inline. The existing `sale-wizard-redesign` plan addressed the LAYOUT (sidebar removal, compact bar) but NOT the customer lookup UX.

**Current problems (from screenshot analysis):**

1. **Manual search**: User must type document + click "Buscar" button. Should auto-search on input.
2. **Excessive scroll on create**: Inline creation form has 5 fields + dirección stacked vertically (~420px tall). Combined with notes card, requires 2x viewport scroll.
3. **Validation as banner**: "Nombre, apellido y documento son requeridos..." appears as banner at bottom of form — requires scroll to see. Should be inline per-field.
4. **"No encontrado" state hidden**: Warning card + "Crear" button partially hidden behind action bar.
5. **Notes card too tall**: Textarea with 6 rows occupies full right column height. Optional info shouldn't dominate.
6. **"CLIENTE" label redundant**: Header row with "CLIENTE" + "LIMPIAR" + new customer button takes ~60px unnecessarily.
7. **Excessive padding/rounding**: `rounded-[1.5rem]`, `px-5 py-5`, `h-14 w-14` avatars — inflated elements.

## Decisions (confirmed with user)

1. **Notes card**: Reduce textarea from 6 rows to 3 rows
2. **Auto-search**: Debounced auto-search (600ms) on document input + Enter for immediate search. Remove "Buscar" button.
3. **Creation form**: Grid 2 columns — Nombre|Apellido, CI|Teléfono, Email full width, Dirección 2 rows

## Scope

**Primary file:** `src/lib/components/sales/CustomerLookupInput.svelte` (490 lines)
**Secondary file:** `src/lib/components/sales/SaleStep1Info.svelte` (notes textarea rows)

**NOT in scope:**

- Backend logic (lookupCustomer remote function stays as-is)
- Step 2 or Step 3 changes
- Mobile responsive (desktop-first per user)

## Implementation

- CustomerLookupInput: Remove 'CLIENTE' label row (lines 227-256). Integrate 'Limpiar' and 'Nuevo cliente' buttons inline with the search fields row. Saves ~60px vertical.
- CustomerLookupInput: Implement auto-search with debounce. Add searchTimeout state, trigger handleSearch() 600ms after idDigits input stops. Remove 'Buscar' button (lines 293-308). Keep Enter key for immediate search. Show spinner in document input while searching.
- CustomerLookupInput: Compact creation form to 2-column grid. Row 1: Nombre | Apellido. Row 2: CI (prefix+digits inline) | Telefono. Row 3: Email (full width). Row 4: Direccion textarea 2 rows. Reduce field gap from gap-4 to gap-3. Reduce field padding from px-4 py-3 to px-3 py-2.5.
- CustomerLookupInput: Replace bottom validation banner (lines 483-487) with inline per-field validation. Add red border (ring-1 ring-error/40) + small error text below field when firstName, lastName, or idNumber is empty. Remove the banner warning div entirely.
- CustomerLookupInput: Compact 'found' customer card (lines 311-356). Reduce avatar from h-14 w-14 to h-10 w-10, rounded-2xl to rounded-lg, px-5 py-5 to px-4 py-3, text-xl to text-lg for name. Compact 'Cliente seleccionado' badge.
- CustomerLookupInput: Compact 'missing' state (lines 357-389). Reduce icon from h-12 w-12 to h-8 w-8, px-5 py-5 to px-4 py-3, rounded-[1.5rem] to rounded-lg. Make 'Crear cliente' button more prominent (bg-brand-gold text-brand-navy) so it's clearly visible.
- CustomerLookupInput: Standardize all rounded corners. Change rounded-[1.5rem] to rounded-xl, rounded-2xl to rounded-lg, fieldInputClass rounded-xl to rounded-lg.
- SaleStep1Info: Reduce notes textarea from rows={4} to rows={3}. Reduce notes card padding from px-5 py-5 to px-4 py-3.
- Verify: run pnpm prettier, pnpm eslint, pnpm svelte-check, pnpm test:unit. Test at 1280x720: customer lookup without scroll, creation form fits in viewport, 'no encontrado' state visible without scroll.

## Required Specs

<!-- SPECS_START -->

- step1-customer-patterns
<!-- SPECS_END -->
