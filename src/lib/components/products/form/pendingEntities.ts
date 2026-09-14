import type { PendingEntity, SelectOption } from '$lib/components/ui';
import { generateUUID } from '$lib/utils/generateUUID';
import { ProductType, toMaterialCategory } from '$lib/shared/enums';

export function handleCreatePendingBrand(
	pendingBrands: PendingEntity[],
	name: string
): { updated: PendingEntity[]; option: SelectOption } {
	const pendingId = `pending_brand_${generateUUID()}`;
	return {
		updated: [...pendingBrands, { pendingId, name }],
		option: { id: pendingId, name, isPending: true }
	};
}

export function handleCreatePendingSupplier(
	pendingSuppliers: PendingEntity[],
	name: string
): { updated: PendingEntity[]; option: SelectOption } {
	const pendingId = `pending_supplier_${generateUUID()}`;
	return {
		updated: [...pendingSuppliers, { pendingId, name }],
		option: { id: pendingId, name, isPending: true }
	};
}

export function handleCreatePendingMaterial(
	pendingMaterials: PendingEntity[],
	name: string,
	productType: string
): { updated: PendingEntity[]; option: SelectOption } {
	const pendingId = `pending_material_${generateUUID()}`;
	return {
		updated: [...pendingMaterials, { pendingId, name, productType }],
		option: { id: pendingId, name, isPending: true }
	};
}

export function getPendingName(
	pendingId: string,
	pendingBrands: PendingEntity[],
	pendingSuppliers: PendingEntity[],
	pendingMaterials: PendingEntity[],
	pendingModels: PendingEntity[]
): string | null {
	if (!pendingId.startsWith('pending_')) return null;

	const brand = pendingBrands.find((pendingBrand) => pendingBrand.pendingId === pendingId);
	if (brand) return brand.name;

	const supplier = pendingSuppliers.find(
		(pendingSupplier) => pendingSupplier.pendingId === pendingId
	);
	if (supplier) return supplier.name;

	const material = pendingMaterials.find(
		(pendingMaterial) => pendingMaterial.pendingId === pendingId
	);
	if (material) return material.name;

	const model = pendingModels.find((pendingModel) => pendingModel.pendingId === pendingId);
	if (model) return model.name;

	return null;
}

export function getPendingMaterialCategory(
	pendingId: string,
	pendingMaterials: PendingEntity[]
): string | null {
	if (!pendingId.startsWith('pending_material_')) return null;
	const material = pendingMaterials.find(
		(pendingMaterial) => pendingMaterial.pendingId === pendingId
	);
	return typeof material?.productType === 'string'
		? toMaterialCategory(material.productType as ProductType)
		: null;
}
