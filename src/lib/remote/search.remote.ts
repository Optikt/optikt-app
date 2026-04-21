/**
 * Universal Search Remote Function
 * Searches across products and lab lens catalog
 */
import { query } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { UniversalSearchSchema } from '$lib/schemas/search';
import { db } from '$lib/server/db';
import {
	products,
	lensCatalogItems,
	lensMaterials,
	suppliers,
	brands
} from '$lib/server/db/schema';
import { eq, and, isNull, ilike, or, desc } from 'drizzle-orm';

/** A product search result */
export interface ProductResult {
	id: string;
	sku: string;
	name: string;
	type: string;
	currentSalePrice: number | null;
	brand?: string | null;
	supplier?: string | null;
}

/** A lab lens catalog search result */
export interface LensCatalogResult {
	id: string;
	name: string;
	type: string;
	source: string;
	materialName: string | null;
	supplierName: string | null;
	basePrice: number;
}

export interface SearchResults {
	products: ProductResult[];
	lenses: LensCatalogResult[];
	query: string;
}

const MAX_RESULTS = 8;

export const universalSearch = query(
	UniversalSearchSchema,
	async (data): Promise<SearchResults> => {
		requireAuth();

		const searchText = data.query.toLowerCase().trim();

		const [productResults, lensResults] = await Promise.all([
			searchProducts(searchText),
			searchLenses(searchText)
		]);

		return {
			products: productResults,
			lenses: lensResults,
			query: data.query
		};
	}
);

async function searchProducts(search: string): Promise<ProductResult[]> {
	const results = await db
		.select({
			id: products.id,
			sku: products.sku,
			name: products.name,
			type: products.type,
			currentSalePrice: products.currentSalePrice,
			brand: brands.name,
			supplier: suppliers.name
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.where(
			and(
				isNull(products.deletedAt),
				eq(products.isActive, true),
				or(
					ilike(products.name, `%${search}%`),
					ilike(products.sku, `%${search}%`),
					ilike(products.type, `%${search}%`)
				)
			)
		)
		.limit(MAX_RESULTS)
		.orderBy(desc(products.createdAt));

	return results;
}

async function searchLenses(search: string): Promise<LensCatalogResult[]> {
	const results = await db
		.select({
			id: lensCatalogItems.id,
			name: lensCatalogItems.name,
			type: lensCatalogItems.type,
			source: lensCatalogItems.source,
			materialName: lensMaterials.name,
			supplierName: suppliers.name,
			basePrice: lensCatalogItems.basePrice
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.where(
			and(
				isNull(lensCatalogItems.deletedAt),
				eq(lensCatalogItems.isActive, true),
				ilike(lensCatalogItems.name, `%${search}%`)
			)
		)
		.limit(MAX_RESULTS)
		.orderBy(desc(lensCatalogItems.createdAt));

	return results;
}
