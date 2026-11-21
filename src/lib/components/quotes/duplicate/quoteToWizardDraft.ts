/**
 * Adapter de DUPLICAR: detalle del presupuesto → estado inicial del wizard de
 * ventas (D7). Se copian ítems (lente, producto, libre y tratamientos hijos),
 * descuento, Cashea y notas. Se resetean: cliente, fecha (hoy), validez
 * (vacía) y número (el wizard muestra el preview nuevo).
 *
 * Cada ítem recibe un id NUEVO: el presupuesto duplicado es independiente y
 * reusar los ids del origen viola `quote_items_pkey`. La FÓRMULA no se copia
 * (solo qué ojos aplican): el usuario la reescribe en el paso 2 para no
 * arrastrar una graduación equivocada.
 */

import type { QuoteItemWithDetails, QuoteWithRelations } from '$lib/server/db/queries/quotes/types';
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
import {
	clearLabels,
	hasAnyLabel,
	remapGroupItemIds,
	dropEmptyGroups,
	type ItemGroup
} from '$lib/shared/saleItemGroups';

export interface QuoteWizardDraft {
	items: SaleItemRow[];
	discount: number;
	discountType: string;
	notes: string;
	isCashea: boolean;
	/** Per-person pairing kept, names cleared (like the Rx). */
	groups: ItemGroup[];
	/** Names cleared → the wizard warns (never blocks). */
	clearedNames: number;
}

/** Ojo vacío: conserva si el ojo aplicaba, nunca los valores de la fórmula. */
function eyeFromSnapshot(item: QuoteItemWithDetails, eye: 'od' | 'os'): LensEyeEntry {
	const sphere = item[`${eye}Sphere` as 'odSphere' | 'osSphere'];
	const cylinder = item[`${eye}Cylinder` as 'odCylinder' | 'osCylinder'];
	const axis = item[`${eye}Axis` as 'odAxis' | 'osAxis'];
	const addition = item[`${eye}Addition` as 'odAddition' | 'osAddition'];
	const hasValues = sphere != null || cylinder != null || axis != null || addition != null;

	return {
		enabled: hasValues,
		prescription: { sphere: null, cylinder: null, axis: null, addition: null },
		dp: null,
		np: null,
		altura: null
	};
}

/** Lente del presupuesto → fila de wizard (mismo cristal, fórmula en blanco). */
function lensRow(
	item: QuoteItemWithDetails,
	lensCatalogItemId: string,
	id: string
): LensSaleItemRow | null {
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
		id,
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

function productRow(item: QuoteItemWithDetails, productId: string, id: string): ProductSaleItemRow {
	return {
		id,
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

function freeRow(item: QuoteItemWithDetails, id: string): FreeSaleItemRow | null {
	if (!item.freeDetails) return null;
	return {
		id,
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

function treatmentRow(
	item: QuoteItemWithDetails,
	parentLensItemId: string,
	id: string
): TreatmentSaleItemRow {
	return {
		id,
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
 * Ids regenerados; la relación padre-hijo de tratamientos se remapea.
 */
export function quoteToWizardDraft(detail: {
	quote: QuoteWithRelations;
	items: QuoteItemWithDetails[];
	groups?: ItemGroup[];
}): QuoteWizardDraft {
	const rows: SaleItemRow[] = [];
	// id del origen → id nuevo (los tratamientos apuntan al lente por id)
	const newIds = new Map(detail.items.map((i) => [i.id, crypto.randomUUID()]));
	const idOf = (item: QuoteItemWithDetails) => newIds.get(item.id)!;

	for (const item of detail.items) {
		if (item.itemType === SaleItemType.TREATMENT) continue; // hijos: se cuelan en su lente
		if (item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItemId) {
			const lens = lensRow(item, item.lensCatalogItemId, idOf(item));
			if (lens) {
				rows.push(lens);
				continue;
			}
		}
		if (item.itemType === SaleItemType.FREE_ITEM) {
			const free = freeRow(item, idOf(item));
			if (free) {
				rows.push(free);
				continue;
			}
		}
		if (item.productId) {
			rows.push(productRow(item, item.productId, idOf(item)));
		}
	}

	// Tratamientos hijos → filas de nivel superior (kind 'treatment') tras su lente padre
	for (const item of detail.items) {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentQuoteItemId) continue;
		const parentId = newIds.get(item.parentQuoteItemId);
		const parentIndex = rows.findIndex((r) => r.id === parentId);
		if (parentId && parentIndex >= 0) {
			rows.splice(parentIndex + 1, 0, treatmentRow(item, parentId, idOf(item)));
		}
	}

	// Pairing survives with the new ids (only rows that made it into the wizard).
	const rowIds = new Set(rows.map((r) => r.id));
	const keptIds = new Map([...newIds].filter(([, id]) => rowIds.has(id)));
	const sourceGroups = detail.groups ?? [];
	const groups = dropEmptyGroups(clearLabels(remapGroupItemIds(sourceGroups, keptIds)));
	const clearedNames = hasAnyLabel(sourceGroups)
		? sourceGroups.filter((g) => (g.label ?? '').trim() !== '').length
		: 0;

	return {
		items: rows,
		groups,
		clearedNames,
		discount: detail.quote.discount,
		discountType: detail.quote.discountType,
		notes: detail.quote.notes ?? '',
		isCashea: detail.quote.isCashea
	};
}
