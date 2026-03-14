# Phase 0 Domain Contracts

## Purpose
This document freezes the business contract for the rewrite before schema or UI work continues.

## Core decisions

### Lens identity vs treatment policy
- Photochromic is part of lens identity, not an optional treatment.
- AR and Bluecut are evaluated per item from the selected supplier's own catalog.
- A treatment offered by supplier A cannot be applied to a lens item from supplier B.

### Exact signature rule
- Requested signature must match the final offered signature exactly.
- If the request is Photochromic + AR, then Photochromic + AR + Bluecut does not match.
- If the request is Photochromic only, then a lens with inherent AR also does not match.

### Range rule
- If the lens item publishes ranges, those ranges must be validated.
- If the lens item does not publish ranges but the signature matches, the result is consult required.

### Surplus rule
- A surplus unit is a real physical lens unit without cutting.
- It is not locked to OD or OI.
- It can satisfy either eye if the physical signature matches exactly and the formula need is compatible.

## Provider/item compatibility matrix

Important:
- This matrix is evaluated per catalog item, not globally per supplier.
- A supplier can have multiple items with different combinations of inherent and optional treatments.

| Provider example | Item example | Photochromic | AR | Bluecut | Interpretation |
|---|---|---|---|---|---|
| Crystal Royal | Monofocal Photochromic AR Bluecut | Inherent | Inherent | Inherent | Closed combination, no extra treatments |
| Crystal Royal | Monofocal Photochromic AR | Inherent | Inherent | Not available | Different closed combination |
| Novak | Monofocal Photochromic | Inherent | Optional extra | Not available | AR can be added only on Novak's own item |
| Novak | Monofocal Photochromic Bluecut | Inherent | Optional extra | Inherent | Bluecut is already part of the item |
| FreeForm | Monofocal with AR | None or Inherent depending on item | Inherent | Optional extra | Bluecut may be added as an extra |
| FreeForm | Monofocal without AR | None | Not available on this item if sold as closed version | Optional extra | Item-level policy wins |

## Planner output expectations
- Every lens need becomes unit-based planning, even if the UI line still looks like one lens item.
- Planner output must explain inventory usage, provider order, pair ordering, surplus creation, and manual confirmations.
- Planner output is shared by sale creation, quote creation, and advanced lens search.

## Search contract
- `#` targets document-like identifiers.
- `@` targets customers.
- `!` targets product search.
- `*` targets lenses.
- `%` targets provider/brand search.
- Lens search must accept `od:` and `oi:` values with two tokens `(sphere cylinder)` or three tokens `(sphere cylinder addition)`.
- Axis is accepted for capture but ignored for matching.

## Phase 0 exit criteria
- Contracts exist in source code.
- UX status dictionary exists in source code.
- Compatibility matrix exists as a written business reference.
- Next phase can replace schema and behavior without redefining the business rules.

## Legacy targets to replace in next phases

### Tables and schema areas
- `lens_catalog_items`: replace boolean treatment flags and flattening assumptions with the new trait/policy model.
- `supplier_lens_treatments`: keep only if still useful after item-level policy redesign; otherwise replace with item-scoped treatment pricing/policy.
- `lens_optical_ranges`: keep the range concept, but bind it to the new `rangeAvailability` contract.
- `sale_items`: replace flat `selectedTreatments` assumptions with planner-driven fulfillment data and richer lens snapshots.
- `products`: extend pricing fields with tax-aware pricing fields.

### Files and logic areas
- `src/lib/server/db/schema/lenses.ts`
- `src/lib/schemas/lenses.ts`
- `src/lib/server/db/queries/lenses.ts`
- `src/lib/utils/lensMatching.ts`
- `src/lib/utils/opticalParser.ts`
- `src/lib/components/sales/SaleStep2Items.svelte`
- `src/lib/components/sales/NewSaleForm.svelte`
- `src/lib/remote/search.remote.ts`
- `src/lib/components/layout/CommandSearch.svelte`
- `src/lib/remote/sales.remote.ts`
- `src/lib/server/db/schema/sales.ts`

### Rewrite rule
- These targets are not protected by backward compatibility requirements.
- They can be replaced directly once the new implementation compiles and passes its tests.