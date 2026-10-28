import type { ProductWithRelations } from '#lib/server/db/queries/products.js';
import type { LensCatalogItemWithRelations } from '#lib/server/db/queries/lenses/catalog.js';

export const CATALOG_KEY = Symbol('catalog');
export const SALE_KEY = Symbol('sale');

export interface CatalogData {
	/** Resolve the catalog on access — cache-backed in the sale wizard, prop-backed in the quote wizard. */
	getProducts: () => ProductWithRelations[];
	getLensItems: () => LensCatalogItemWithRelations[];
}
