# Spec: wizard-context

Scope: feature

# Spec: wizard-context

Scope: feature

# Context API for Wizard Prop Drilling Elimination

Replace 3-4 levels of prop threading across the sales/quote wizard with Svelte 5 context API (`setContext`/`getContext`).

## Phase 1: Catalog Data (immutable — biggest win, lowest risk)

### Context

```ts
// src/lib/components/sales/wizardContext.ts
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

export const CATALOG_KEY = Symbol('catalog');

export interface CatalogData {
  readonly products: ProductWithRelations[];
  readonly lensItems: LensCatalogItemWithRelations[];
}
```

### Set context (NewSaleForm.svelte + NewQuoteForm.svelte)

```ts
import { setContext } from 'svelte';
import { CATALOG_KEY, type CatalogData } from './wizardContext';
setContext<CatalogData>(CATALOG_KEY, { products, lensItems });
```

### Consumers (8 components to update)

| Component | Remove from Props | Add |
|---|---|---|
| `SaleStep2Items.svelte` | `products`, `lensItems` | `const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY)` |
| `SaleStep2ItemCard.svelte` | `products`, `lensItems` | same |
| `SaleStep2SearchBar.svelte` | `products`, `lensItems` | same |
| `SaleStep3Summary.svelte` | `products`, `lensItems` | same |
| `QuoteStep3Summary.svelte` | `products`, `lensItems` | same |
| `NewSaleForm.svelte` | (removes pass-through) | `setContext(CATALOG_KEY, ...)` |
| `NewQuoteForm.svelte` | (removes pass-through) | `setContext(CATALOG_KEY, ...)` |
| `SaleStep2Toolbar.svelte` | (doesn't use them — no change) | — |

### Template cleanup

```diff
- <SaleStep2Items {products} {lensItems} ... />
+ <SaleStep2Items ... />
```
Repeat for all consumers.

## Phase 2: Sale Data (mutable — $state wrapper)

### Context

```ts
export const SALE_KEY = Symbol('sale');

export interface SaleCtx {
  items: SaleItemRow[];
  includedAccessoryMap: IncludedAccessoryMap;
  selectedCustomer: Customer | null;
  newCustomer: NewCustomerData | null;
  customerPrescription: Prescription | null;
  labels: {
    fallbackName: string;
    fallbackDocument: string;
    newCustomerContextLabel: string;
    selectedCustomerContextLabel: string;
    noCustomerContextLabel: string;
  };
  discount: number;
  discountType: DiscountType;
  notes: string;
  saleDate: Date;
  secondaryDate: string;
}
```

### Set context

```ts
const saleCtx: SaleCtx = $state({
  items,
  includedAccessoryMap,
  selectedCustomer,
  newCustomer,
  customerPrescription,
  labels: {
    fallbackName: customerFallbackName,
    fallbackDocument: customerFallbackDocument,
    newCustomerContextLabel,
    selectedCustomerContextLabel,
    noCustomerContextLabel
  },
  discount,
  discountType,
  notes,
  saleDate,
  secondaryDate: ''
});
setContext(SALE_KEY, saleCtx);
```

### Critical pattern

All reassignments must go through the wrapper:

```diff
- selectedCustomer = result.customer;
+ saleCtx.selectedCustomer = result.customer;

- items = [...items, nextItem];
+ saleCtx.items = [...saleCtx.items, nextItem];
```

This ensures reactivity propagates through context.

### Consumers

Same pattern — `getContext<SaleCtx>(SALE_KEY)` and read from the object.

### Props to remove from wizard steps

| Component | Props removed |
|---|---|
| `SaleStep1Info` | `customerId`, `selectedCustomer`, `newCustomer`, `saleDate`, `notes` |
| `SaleStep2Items` | `customerPrescription`, `selectedCustomer`, `newCustomer`, `customerFallbackName`, `customerFallbackDocument`, `newCustomerContextLabel`, `selectedCustomerContextLabel`, `noCustomerContextLabel`, `items`, `includedAccessoryMap` |
| `SaleStep3Summary` | `selectedCustomer`, `newCustomer`, `saleDate`, `discount`, `discountType`, `notes`, `customerId`, `items` |

### What stays as props (can't be in context)

- `valid` — computed per-step, different for each
- `onnext`, `onprev` — step-specific navigation
- `onCancel` — step-specific
- Per-item values in loops (`rxErrs`, `eyeCount`, `treatmentTotal`, `rangeWarnings`, `availableTreatments`)
- `customerId` (CUSTOMER_ID) — specific to step 1 lookup flow