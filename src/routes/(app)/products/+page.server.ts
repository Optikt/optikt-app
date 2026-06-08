import type { PageServerLoad } from './$types';
import {
	getAllProductsWithRelations,
	countProducts,
	getProductInventoryStats
} from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { brands, suppliers } from '$lib/server/db/schema';
import { ProductStockFilter } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ url }) => {
	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const perPage = 10;
	const search = searchParams.get('q')?.trim() || undefined;
	const type = searchParams.get('type')?.trim() || undefined;
	const brandId = searchParams.get('brand')?.trim() || undefined;
	const supplierId = searchParams.get('supplier')?.trim() || undefined;
	const includeDeleted = searchParams.get('deleted') === '1';

	const rawStockStatus = searchParams.get('stock')?.trim();
	const stockStatus =
		rawStockStatus &&
		Object.values(ProductStockFilter).includes(rawStockStatus as ProductStockFilter)
			? (rawStockStatus as ProductStockFilter)
			: undefined;

	const offset = (page - 1) * perPage;

	const [initialProducts, totalCount, stats, brandsList, suppliersList] = await Promise.all([
		getAllProductsWithRelations({
			search,
			type,
			brandId,
			supplierId,
			stockStatus,
			includeDeleted,
			offset,
			limit: perPage,
			orderBy: 'createdAt',
			orderSort: 'desc'
		}),
		countProducts({ search, type, brandId, supplierId, stockStatus, includeDeleted }),
		getProductInventoryStats(),
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } })
	]);

	return {
		initialProducts,
		totalCount,
		stats,
		brands: brandsList,
		suppliers: suppliersList
	};
};
