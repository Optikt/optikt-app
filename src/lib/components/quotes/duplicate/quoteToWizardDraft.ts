/**
 * Adapter de DUPLICAR: detalle del presupuesto → estado inicial del wizard de
 * ventas (D7). Se copian ítems (con fórmula por ítem y tratamientos hijos),
 * descuento, Cashea y notas. Se resetean: cliente, fecha (hoy), validez
 * (vacía) y número (el wizard muestra el preview nuevo).
 */

import type { QuoteItemWithDetails, QuoteWithRelations } from '$lib/server/db/queries/quotes';
import type {
	SaleItemRow,
	LensSaleItemRow,
	ProductSaleItemRow,
	FreeSaleItemRow,
	TreatmentSaleItemRow,
	LensPairEntry,
	LensEyeEntry
} from '$lib/components/sales/newSaleTypes';
import { DiscountType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

export interface QuoteWizardDraft {
	items: SaleItemRow[];
	discount: number;
	discountType: string;
	notes: string;
	isCashea: boolean;
}

function eyeFromSnapshot(item: QuoteItemWithDetails, eye: 'od' | 'os'): LensEyeEntry {
	const prefix = eye;
	const sphere = item[`${prefix}Sphere` as 'odSphere' | 'osSphere'];
	const cylinder = item[`${prefix}Cylinder` as 'odCylinder' | 'osCylinder'];
	const axis = item[`${prefix}Axis` as 'odAxis' | 'osAxis'];
	const addition = item[`${prefix}Addition` as 'odAddition' | 'osAddition'];
	const altura = item[`${prefix}Altura` as 'odAltura' | 'osAltura'];
	const hasValues = sphere != null || cylinder != null || axis != null || addition != null;

	return {
		enabled: hasValues,
		prescription: {
			sphere: sphere ?? null,
			cylinder: cylinder ?? null,
			axis: axis ?? null,
			addition: addition ?? null
		},
		dp: null,
		np: null,
		altura: altura ?? null
	};
}

/** Lente del presupuesto → fila de wizard (con fórmula por ojo, incluida altura). */
function lensRow(item: QuoteItemWithDetails, lensCatalogItemId: string): LensSaleItemRow | null {
	const od = eyeFromSnapshot(item, 'od');
	const oi = eyeFromSnapshot(item, 'os');
	if (!od.enabled && !oi.enabled) return null;

	const pair: LensPairEntry = {
		catalogItemId: lensCatalogItemId,
		od,
		oi,
		lensType: item.lensCatalogItem?.type ?? 'MONOFOCAL',
		doctorName: ''
	};

	return {
		id: item.id,
		kind: 'lens',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		productId: item.productId ?? '',
		quantity: 1,
		lensPair: pair,
		treatments: [],
		costOverrides: {
			baseCost: item.snapshotBaseCost ?? 0,
			mountingPrice: item.snapshotMountingPrice ?? 0,
			shippingPrice: item.snapshotShippingPrice ?? 0
		},
		shippingCostPending: item.snapshotShippingPrice == null,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: (item.discountType as DiscountType) ?? DiscountType.FIXED,
		notes: item.notes ?? ''
	};
}

function productRow(item: QuoteItemWithDetails, productId: string): ProductSaleItemRow {
	return {
		id: item.id,
		kind: 'product',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		productId,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: (item.discountType as DiscountType) ?? DiscountType.FIXED,
		notes: item.notes ?? ''
	};
}

function freeRow(item: QuoteItemWithDetails): FreeSaleItemRow | null {
	if (!item.freeDetails) return null;
	return {
		id: item.id,
		kind: 'free',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		productId: item.productId ?? '',
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: (item.discountType as DiscountType) ?? DiscountType.FIXED,
		notes: item.notes ?? '',
		freeItem: {
			category: item.freeDetails.category,
			description: item.freeDetails.description,
			unitCost: item.freeDetails.unitCost,
			supplierId: item.freeDetails.supplierId,
			opticalNotes: item.freeDetails.opticalNotes ?? ''
		}
	};
}

function treatmentRow(item: QuoteItemWithDetails, parentLensItemId: string): TreatmentSaleItemRow {
	return {
		id: item.id,
		kind: 'treatment',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: (item.discountType as DiscountType) ?? DiscountType.FIXED,
		notes: item.notes ?? '',
		parentLensItemId,
		supplierTreatmentId: item.supplierTreatmentId ?? '',
		treatmentName: item.snapshotName ?? 'Tratamiento',
		treatmentCategory: item.snapshotTreatmentCategory ?? '',
		isTaxable: item.snapshotIsTaxable ?? true,
		snapshotBrand: item.snapshotBrand ?? '',
		purchasePrice: item.snapshotBaseCost ?? 0
	};
}

/**
 * `quoteToWizardDraft(detail)` → estado inicial del wizard de Nueva venta.
 * Los ítems conservan sus ids (relación padre-hijo de tratamientos intacta).
 */
export function quoteToWizardDraft(detail: {
	quote: QuoteWithRelations;
	items: QuoteItemWithDetails[];
}): QuoteWizardDraft {
	const rows: SaleItemRow[] = [];

	for (const item of detail.items) {
		if (item.itemType === SaleItemType.TREATMENT) continue; // hijos: se cuelan en su lente
		if (item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItemId) {
			const lens = lensRow(item, item.lensCatalogItemId);
			if (lens) {
				rows.push(lens);
				continue;
			}
		}
		if (item.itemType === SaleItemType.FREE_ITEM) {
			const free = freeRow(item);
			if (free) {
				rows.push(free);
				continue;
			}
		}
		if (item.productId) {
			rows.push(productRow(item, item.productId));
		}
	}

	// Tratamientos hijos → filas de nivel superior (kind 'treatment') tras su lente padre
	for (const item of detail.items) {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentQuoteItemId) continue;
		const parentIndex = rows.findIndex((r) => r.id === item.parentQuoteItemId);
		if (parentIndex >= 0) {
			rows.splice(parentIndex + 1, 0, treatmentRow(item, item.parentQuoteItemId));
		}
	}

	return {
		items: rows,
		discount: detail.quote.discount,
		discountType: detail.quote.discountType,
		notes: detail.quote.notes ?? '',
		isCashea: detail.quote.isCashea
	};
}
