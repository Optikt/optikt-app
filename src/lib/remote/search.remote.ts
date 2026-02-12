/**
 * Universal Search Remote Function
 * Searches across products and lab lens catalog with optical parameter parsing
 */
import { query } from '$app/server';
import { UniversalSearchSchema } from '$lib/schemas/search';
import { parseOpticalInput, type OpticalParams } from '$lib/utils/opticalParser';
import { db } from '$lib/server/db';
import {
	products,
	lensCatalogItems,
	lensMaterials,
	suppliers,
	brands
} from '$lib/server/db/schema';
import { eq, and, isNull, ilike, or, gte, lte, desc } from 'drizzle-orm';

/** A product search result */
export interface ProductResult {
	id: string;
	sku: string;
	name: string;
	type: string;
	salePrice: number;
	brand?: string | null;
	supplier?: string | null;
}

/** A lab lens catalog search result */
export interface LensCatalogResult {
	id: string;
	name: string;
	brand: string | null;
	type: string;
	source: string;
	materialName: string | null;
	supplierName: string | null;
	sphereMin: number;
	sphereMax: number;
	cylinderMin: number | null;
	cylinderMax: number | null;
	basePrice: number;
}

export interface SearchResults {
	products: ProductResult[];
	lenses: LensCatalogResult[];
	query: string;
	isOptical: boolean;
}

const MAX_RESULTS = 8;

export const universalSearch = query(
	UniversalSearchSchema,
	async (data): Promise<SearchResults> => {
		const parsed = parseOpticalInput(data.query);
		const searchText = data.query.toLowerCase().trim();

		const [productResults, lensResults] = await Promise.all([
			searchProducts(searchText),
			searchLenses(searchText, parsed.optical)
		]);

		return {
			products: productResults,
			lenses: lensResults,
			query: data.query,
			isOptical: parsed.isOptical
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
			salePrice: products.salePrice,
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

async function searchLenses(
	search: string,
	optical: OpticalParams | null
): Promise<LensCatalogResult[]> {
	const baseConditions = [isNull(lensCatalogItems.deletedAt), eq(lensCatalogItems.isActive, true)];

	// If optical params detected, search by sphere/cylinder range
	if (optical?.sphere !== undefined) {
		baseConditions.push(lte(lensCatalogItems.sphereMin, optical.sphere));
		baseConditions.push(gte(lensCatalogItems.sphereMax, optical.sphere));

		if (optical.cylinder !== undefined && optical.cylinder < 0) {
			baseConditions.push(lte(lensCatalogItems.cylinderMin, optical.cylinder));
		}
	} else {
		// Text search on name/brand
		baseConditions.push(
			or(ilike(lensCatalogItems.name, `%${search}%`), ilike(lensCatalogItems.brand, `%${search}%`))!
		);
	}

	const results = await db
		.select({
			id: lensCatalogItems.id,
			name: lensCatalogItems.name,
			brand: lensCatalogItems.brand,
			type: lensCatalogItems.type,
			source: lensCatalogItems.source,
			materialName: lensMaterials.name,
			supplierName: suppliers.name,
			sphereMin: lensCatalogItems.sphereMin,
			sphereMax: lensCatalogItems.sphereMax,
			cylinderMin: lensCatalogItems.cylinderMin,
			cylinderMax: lensCatalogItems.cylinderMax,
			basePrice: lensCatalogItems.basePrice
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.where(and(...baseConditions))
		.limit(MAX_RESULTS)
		.orderBy(desc(lensCatalogItems.createdAt));

	return results;
}
