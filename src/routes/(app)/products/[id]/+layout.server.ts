import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getBrandAccessories,
	getProductAccessoryOverride
} from '$lib/server/db/queries/brandAccessories';
import { getBrandSupplierMaps } from '$lib/server/db/queries/brandSuppliers';
import { findProductByIdWithRelations } from '$lib/server/db/queries/products';
import { isValidUuid } from '$lib/utils/uuid';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllMaterials } from '$lib/server/db/queries/materials';
import { getActiveLotsFifo, getNextFifoCost } from '$lib/server/db/queries/inventoryLots';
import {
	getMovementsWithDetails,
	countInventoryMovements
} from '$lib/server/db/queries/inventoryMovements';
import { ProductType } from '$lib/shared/enums/productTypes';
import { brands, suppliers, materials } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ params }) => {
	// Only accept valid UUIDs for product IDs to avoid treating
	if (!isValidUuid(params.id)) {
		error(404, 'Producto no encontrado');
	}

	const product = await findProductByIdWithRelations(params.id);

	if (!product) {
		error(404, 'Producto no encontrado');
	}

	const supportsIncludedAccessories =
		!!product.brandId &&
		(product.type === ProductType.FRAME || product.type === ProductType.SUNGLASSES);

	// Load brands, suppliers, and materials for edit form (only needed columns)
	const [
		brandsList,
		suppliersList,
		materialsList,
		relationMaps,
		activeLots,
		fifoCost,
		productMovements,
		productMovementsCount,
		brandAccessories,
		productAccessoryOverride
	] = await Promise.all([
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } }),
		getAllMaterials({
			columns: {
				id: materials.id,
				name: materials.name,
				productType: materials.productType
			}
		}),
		getBrandSupplierMaps(),
		getActiveLotsFifo(product.id),
		getNextFifoCost(product.id),
		getMovementsWithDetails({ productId: product.id, limit: 10 }),
		countInventoryMovements({ productId: product.id }),
		supportsIncludedAccessories && product.brandId
			? getBrandAccessories(product.brandId)
			: Promise.resolve([]),
		supportsIncludedAccessories ? getProductAccessoryOverride(product.id) : Promise.resolve(null)
	]);

	return {
		product,
		brands: brandsList,
		suppliers: suppliersList,
		materials: materialsList,
		...relationMaps,
		activeLots,
		fifoCost,
		productMovements,
		productMovementsCount,
		brandAccessories,
		productAccessoryOverride
	};
};
