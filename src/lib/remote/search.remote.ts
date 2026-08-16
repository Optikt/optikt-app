/**
 * Universal Search Remote Function
 * Searches across products and lab lens catalog with token-based ranking
 * (best matches first — same search used by /lenses and the wizards).
 */
import { query } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { UniversalSearchSchema } from '$lib/schemas/search';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';

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

		const search = data.query.trim();
		const [productResults, lensResults] = await Promise.all([
			searchProducts(search),
			searchLenses(search)
		]);

		return {
			products: productResults,
			lenses: lensResults,
			query: data.query
		};
	}
);

async function searchProducts(search: string): Promise<ProductResult[]> {
	// Token search with SQL relevance ranking (name, sku, personalCode, brand, supplier)
	const results = await getAllProductsWithRelations({ search, limit: MAX_RESULTS });

	return results.map((p) => ({
		id: p.id,
		sku: p.sku,
		name: p.name,
		type: p.type,
		currentSalePrice: p.currentSalePrice,
		brand: p.brand?.name ?? null,
		supplier: p.supplier?.name ?? null
	}));
}

async function searchLenses(search: string): Promise<LensCatalogResult[]> {
	// Token search with relevance ranking (name, supplier, material, technology,
	// differentiators, AR/BLUE/FOTOCROMÁTICO, colors) — same as /lenses.
	const results = await getLensCatalogItemsWithRelations({ search });

	return results.slice(0, MAX_RESULTS).map((l) => ({
		id: l.id,
		name: l.name,
		type: l.type,
		source: l.source,
		materialName: l.material?.name ?? null,
		supplierName: l.supplier?.name ?? null,
		basePrice: l.basePrice
	}));
}
