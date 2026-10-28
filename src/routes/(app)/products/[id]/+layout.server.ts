import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getBrandAccessories,
	getProductAccessoryOverride
} from '#lib/server/db/queries/brandAccessories/reads.js';
import { getBrandSupplierMaps } from '#lib/server/db/queries/brandSuppliers.js';
import { findProductByIdWithRelations } from '#lib/server/db/queries/products.js';
import { isValidUuid } from '#lib/utils/uuid.js';
import { getAllBrands } from '#lib/server/db/queries/brands.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';
import { getAllMaterials } from '#lib/server/db/queries/materials.js';
import { getActiveLotsFifo, getNextFifoCost } from '#lib/server/db/queries/inventoryLots.js';
import {
	getMovementsWithDetails,
	countInventoryMovements
} from '#lib/server/db/queries/inventoryMovements.js';
import { ProductType } from '#lib/shared/enums/productTypes.js';
import { brands, suppliers, materials } from '#lib/server/db/schema/index.js';

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
