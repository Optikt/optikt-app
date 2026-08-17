---
plan name: lazy-catalog-search
plan description: Lazy catalog load + ranked search
plan status: completed
---

## Idea

`/sales/new`, `/purchases/new` y `/sales/[id]` cargan el catálogo completo en SSR (471 productos + 240 lentes con relaciones ≈ 1MB JSON por página). La DB no es el problema (tablas ~700KB, joins lean) — el costo es serialización + transferencia + parse + hidratación de ~700 objetos reactivos. Resultado: segundos de espera al abrir "Nueva venta" / "Nueva compra".

La solución: SSR mínimo (solo lo esencial: suppliers, orderNumber, isAdmin) + catálogo bajo demanda vía remote search con ranking de mejores coincidencias — el mismo patrón de búsqueda por tokens que ya existe en `/lenses` (`matchesAllTokens` + `computeRelevanceScore`) y la relevancia SQL de productos (`relevanceScoreOrderSql`).

Aditivo: el search bar global (`universalSearch`) tiene un TODO explícito (CommandSearch.svelte:26) — busca con `ilike` tonto ordenado por createdAt. Se migra al mismo search con ranking.

## Implementation

1. **Remote `searchCatalog`** (`src/lib/remote/catalog.remote.ts`):
   - Schema `CatalogSearchSchema`: `{ q?: string, supplierId?: string, limit?: number (default 20) }`
   - Retorna `{ products: ProductWithRelations[], lensItems: LensCatalogItemWithRelations[] }` en un roundtrip
   - Productos → `getAllProductsWithRelations({ search: q, supplierId, limit })` (relevancia SQL existente)
   - Lentes → `getLensCatalogItemsWithRelations({ search: q })` (token + ranking existente de `/lenses`) + slice a limit
   - Sin q ni supplierId → array vacío (nada de fetch de catálogo completo)

2. **`getLensCatalogItemsWithRelations`: agregar opción `supplierId`** (hoy solo search/technologyId/differentiator) — necesario para el filtro por proveedor en compras.

3. **Cache del wizard** (store en `newSaleTypes.ts` o nuevo store): `catalogCache: Map<id, ProductWithRelations | LensCatalogItemWithRelations>`. Al agregar un item al carrito se cachea el objeto completo → `getAvailableProductStock`, `buildSaleItemsFromWizard`, `buildStep2PrescriptionConfirmation` y el resumen del Step 3 **funcionan sin cambios** (mismo shape que hoy).

4. **`/sales/new`**: SSR queda con suppliers + nextOrderNumber + isAdmin. `SaleStep2SearchBar` → debounce 250ms + min 2 chars + loading → `searchCatalog`. `SaleFormulaSlideOver` (lentes) → typeahead con ranking server-side (el de `/lenses`, campos: name, supplier, material, technology, differentiators, AR/BLUE/FOTOCROMÁTICO, colores).

5. **`/purchases/new`**: SSR solo suppliers. Al validar Step 1 → fetch del set del proveedor (`searchCatalog({ supplierId })`). Combobox → search server-side con `supplierId` cuando se escribe (ranking para lentes).

6. **`/sales/[id]`**: SSR sin productos/lensItems (queda sale+items+payments+movements+suppliers+treatments). `EditSaleModal` → searchCatalog para agregar items; los items existentes pueblan el cache desde `getSaleItemsWithDetails`.

7. **`universalSearch`** (nav global, aditivo): reemplazar los `ilike` de `searchProducts`/`searchLenses` por las queries con ranking — `getAllProductsWithRelations({ search, limit: 8 })` → mapear a `ProductResult`; `getLensCatalogItemsWithRelations({ search })` → mapear a `LensCatalogResult` + slice 8. Mantener el shape de los DTOs (cero cambios en CommandSearch UI).

8. **Tests**: spec del `CatalogSearchSchema`; spec del ranking de lentes (campos tokenizados, mejores coincidencias primero).

## Verificación

- `pnpm check`, `pnpm lint`, `pnpm test:unit`
- Manual: abrir `/sales/new` y `/purchases/new` (debe cargar casi instantáneo); buscar en step 2 con ranking; editar venta desde `/sales/[id]`; global search del nav con mejores coincidencias arriba
- Medir payload SSR antes/después (devtools network)

## Archivos principales

- `src/lib/remote/catalog.remote.ts` (nuevo) + `src/lib/schemas/catalog.ts` (nuevo)
- `src/lib/server/db/queries/lenses.ts` (opción supplierId)
- `src/routes/(app)/sales/new/+page.server.ts` + `+page.svelte`
- `src/lib/components/sales/NewSaleForm.svelte` + `step2/SaleStep2SearchBar.svelte` + `step2/SaleFormulaSlideOver.svelte` + `step2/SaleStep2Items.svelte` + `step3/SaleStep3Summary.svelte`
- `src/routes/(app)/purchases/new/+page.server.ts` + `+page.svelte`
- `src/lib/components/purchases/step2/PurchaseOrderStep2.svelte` + `step2/ProductSearchCombobox.svelte`
- `src/routes/(app)/sales/[id]/+page.server.ts` + `src/lib/components/sales/EditSaleModal.svelte`
- `src/lib/remote/search.remote.ts` (universalSearch ranking)

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->
