/**
 * Shared client-side catalog cache.
 *
 * Sale/purchase wizards used to receive the full catalog via SSR props.
 * Now the catalog is fetched on demand (searchCatalog) and items are
 * cached here as they are selected, so existing helpers that consume
 * `products` / `lensItems` arrays keep working with the same shape.
 */
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

const state = $state({
	products: new Map<string, ProductWithRelations>(),
	lensItems: new Map<string, LensCatalogItemWithRelations>()
});

export function cacheCatalogItems(
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): void {
	for (const p of products) state.products.set(p.id, p);
	for (const l of lensItems) state.lensItems.set(l.id, l);
}

export function cacheProduct(product: ProductWithRelations): void {
	state.products.set(product.id, product);
}

export function cacheLensItem(lens: LensCatalogItemWithRelations): void {
	state.lensItems.set(lens.id, lens);
}

export function getCachedProducts(): ProductWithRelations[] {
	return [...state.products.values()];
}

export function getCachedLensItems(): LensCatalogItemWithRelations[] {
	return [...state.lensItems.values()];
}
