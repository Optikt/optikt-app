import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

export const CATALOG_KEY = Symbol('catalog');
export const SALE_KEY = Symbol('sale');

export interface CatalogData {
	products: ProductWithRelations[];
	lensItems: LensCatalogItemWithRelations[];
}
