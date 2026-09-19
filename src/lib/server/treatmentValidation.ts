import { findLensCatalogItemById } from '$lib/server/db/queries/lenses/catalog';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

export interface TreatmentValidationItem {
	id?: string | null;
	itemType: string;
	lensCatalogItemId?: string | null;
	supplierTreatmentId?: string | null;
	parentSaleItemId?: string | null;
	parentQuoteItemId?: string | null;
}

/** Shared TREATMENT validation for sale and quote item lists. */
export async function validateTreatmentItems(
	items: TreatmentValidationItem[]
): Promise<{ error: string } | null> {
	const lensItemMap = new Map<string, string>();
	for (const item of items) {
		if (item.itemType === SaleItemType.LENS_PAIR && item.id && item.lensCatalogItemId) {
			lensItemMap.set(item.id, item.lensCatalogItemId);
		}
	}

	for (const item of items) {
		if (item.itemType !== SaleItemType.TREATMENT) continue;

		const parentId = item.parentSaleItemId ?? item.parentQuoteItemId ?? null;
		if (!parentId) {
			return { error: 'Tratamiento requiere un ítem de lente padre' };
		}
		const parentLensId = lensItemMap.get(parentId);
		if (!parentLensId) {
			return { error: 'Tratamiento referencia un ítem padre que no es tipo LENS_PAIR' };
		}

		if (!item.supplierTreatmentId) {
			return { error: 'Tratamiento requiere un supplierTreatmentId' };
		}

		const lens = await findLensCatalogItemById(parentLensId);
		if (!lens) {
			return { error: 'Lente padre no encontrado' };
		}
		if (lens.source !== 'LAB') {
			return { error: 'Los tratamientos solo aplican a cristales de tipo LAB' };
		}

		const treatment = await findSupplierTreatmentById(item.supplierTreatmentId);
		if (!treatment) {
			return { error: 'Tratamiento de proveedor no encontrado' };
		}
		if (treatment.supplierId !== lens.supplierId) {
			return { error: 'El tratamiento debe pertenecer al mismo proveedor del cristal' };
		}
	}

	return null;
}
