import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
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

	// Load brands, suppliers, and materials for edit form (only needed columns)
	const [
		brandsList,
		suppliersList,
		materialsList,
		relationMaps,
		activeLots,
		fifoCost,
		productMovements,
		productMovementsCount
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
		countInventoryMovements({ productId: product.id })
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
		productMovementsCount
	};
};
