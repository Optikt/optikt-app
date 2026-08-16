/**
 * Catalog Search Remote Function
 * On-demand ranked search across products and lab lens catalog.
 * Used by the sale/purchase wizards and sale edit modal instead of
 * SSR-loading the full catalog.
 */
import { query } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { CatalogSearchSchema, CatalogItemsByIdsSchema } from '$lib/schemas/catalog';
import {
	getAllProductsWithRelations,
	findProductByIdWithRelations
} from '$lib/server/db/queries/products';
import {
	getLensCatalogItemsWithRelations,
	findLensCatalogItemByIdWithRelations
} from '$lib/server/db/queries/lenses';

export const searchCatalog = query(CatalogSearchSchema, async (data) => {
	requireAuth();

	const search = data.q?.trim();
	if (!search && !data.supplierId) {
		return { products: [], lensItems: [] };
	}

	const [products, lensItems] = await Promise.all([
		getAllProductsWithRelations({ search, supplierId: data.supplierId, limit: data.limit }),
		getLensCatalogItemsWithRelations({ search, supplierId: data.supplierId }).then((items) =>
			search ? items.slice(0, data.limit) : items
		)
	]);

	return { products, lensItems };
});

/**
 * Fetch full catalog objects by id — used to seed the wizard cache with
 * the items already present in a sale being edited.
 */
export const getCatalogItemsByIds = query(CatalogItemsByIdsSchema, async (data) => {
	requireAuth();

	const [products, lensItems] = await Promise.all([
		Promise.all((data.productIds ?? []).map((id) => findProductByIdWithRelations(id))),
		Promise.all((data.lensIds ?? []).map((id) => findLensCatalogItemByIdWithRelations(id)))
	]);

	return {
		products: products.filter((p): p is NonNullable<typeof p> => p !== null),
		lensItems: lensItems.filter((l): l is NonNullable<typeof l> => l !== null)
	};
});
