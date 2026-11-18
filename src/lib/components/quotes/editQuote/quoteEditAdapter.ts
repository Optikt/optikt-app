/**
 * Adapter quote ⇄ editor de ventas.
 *
 * El drawer "Modificar presupuesto" es `EditSaleModal` parametrizado (D1):
 * los ítems de quote se traducen a la forma editable de venta
 * (`EditableItem`) y, al guardar, de vuelta a `QuoteItemInput`. La relación
 * padre de tratamientos viaja en `parentSaleItemId` dentro del editor y
 * vuelve a `parentQuoteItemId` en el payload.
 */

import { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import type { QuoteItemInput, UpdateQuoteInput } from '$lib/schemas/quotes';
import {
	existingItemToInput,
	haveItemsChanged,
	type EditableItem
} from '$lib/components/sales/editSaleDraft';

/** Ítem de quote → editable de venta (campos exclusivos de venta en null). */
export function quoteItemToEditable(item: QuoteItemWithDetails): EditableItem {
	const editable = existingItemToInput({
		...item,
		saleId: item.quoteId,
		lotId: null,
		prescriptionId: null,
		dp: null,
		npRight: null,
		npLeft: null,
		snapshotCostTotal: null,
		snapshotCostUnit: null,
		snapshotLotsCount: null,
		shippingCostPending: false
	} as unknown as SaleItemWithDetails);
	// El editor de venta usa parentSaleItemId para la relación padre-hijo;
	// en quote la relación vive en parentQuoteItemId.
	editable.parentSaleItemId = item.parentQuoteItemId ?? undefined;
	return editable;
}

/** Editable de venta → QuoteItemInput (solo campos del schema de quotes). */
export function editableToQuoteItem(item: EditableItem): QuoteItemInput {
	return {
		id: item.id,
		itemType: item.itemType,
		productId: item.productId,
		lensCatalogItemId: item.lensCatalogItemId,
		parentQuoteItemId: item.parentSaleItemId,
		supplierTreatmentId: item.supplierTreatmentId,
		odSphere: item.odSphere,
		odCylinder: item.odCylinder,
		odAxis: item.odAxis,
		odAddition: item.odAddition,
		odAltura: item.odAltura,
		osSphere: item.osSphere,
		osCylinder: item.osCylinder,
		osAxis: item.osAxis,
		osAddition: item.osAddition,
		osAltura: item.osAltura,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: item.discountType,
		snapshotName: item.snapshotName,
		snapshotSku: item.snapshotSku,
		snapshotBrand: item.snapshotBrand,
		snapshotBaseCost: item.snapshotBaseCost,
		snapshotMountingPrice: item.snapshotMountingPrice,
		snapshotShippingPrice: item.snapshotShippingPrice,
		snapshotSalePrice: item.snapshotSalePrice,
		snapshotPriceType: item.snapshotPriceType,
		snapshotTreatmentCategory: item.snapshotTreatmentCategory,
		snapshotIsTaxable: item.snapshotIsTaxable,
		freeItemCategory: item.freeItemCategory,
		freeItemDescription: item.freeItemDescription,
		freeItemUnitCost: item.freeItemUnitCost,
		freeItemSupplierId: item.freeItemSupplierId,
		freeItemOpticalNotes: item.freeItemOpticalNotes,
		notes: item.notes
	};
}

export interface QuoteEditDraft {
	dateIso: string;
	validUntilIso: string;
	notes: string;
	isCashea: boolean;
	discount: number;
	discountType: string;
	items: EditableItem[];
}

/** ¿Cambió algo respecto al presupuesto original? (ítems vía firma estable) */
export function quoteHasChanges(
	quote: {
		createdAt: string;
		validUntil: string | null;
		notes: string | null;
		isCashea: boolean | null;
		discount: number;
		discountType: string;
	},
	originalItems: QuoteItemWithDetails[],
	draft: QuoteEditDraft
): { changed: boolean; itemsChanged: boolean } {
	const itemsChanged = haveItemsChanged(
		originalItems.map((i) => quoteItemToEditable(i)) as unknown as Parameters<
			typeof haveItemsChanged
		>[0],
		draft.items
	);

	return {
		itemsChanged,
		changed:
			draft.dateIso !== quote.createdAt.slice(0, 10) ||
			draft.validUntilIso !== (quote.validUntil ? quote.validUntil.slice(0, 10) : '') ||
			draft.notes !== (quote.notes ?? '') ||
			draft.isCashea !== (quote.isCashea ?? false) ||
			draft.discount !== quote.discount ||
			draft.discountType !== quote.discountType ||
			itemsChanged
	};
}

/** Payload de `updateExistingQuote` desde el draft del drawer.
 *  Los ítems SIEMPRE se envían (el core los reemplaza; el schema los exige). */
export function buildQuoteUpdatePayload(
	quote: {
		id: string;
		createdAt: string;
		validUntil: string | null;
		notes: string | null;
		isCashea: boolean | null;
		discount: number;
		discountType: string;
	},
	draft: QuoteEditDraft,
	_includeItems = true
): UpdateQuoteInput {
	const payload: UpdateQuoteInput = { id: quote.id, items: [] };

	if (draft.dateIso !== quote.createdAt.slice(0, 10)) payload.quoteDate = draft.dateIso;
	if (draft.validUntilIso !== (quote.validUntil ? quote.validUntil.slice(0, 10) : '')) {
		payload.validUntil = draft.validUntilIso || null;
	}
	if (draft.notes !== (quote.notes ?? '')) payload.notes = draft.notes || null;
	if (draft.isCashea !== (quote.isCashea ?? false)) payload.isCashea = draft.isCashea;
	if (draft.discount !== quote.discount) payload.discount = draft.discount;
	if (draft.discountType !== quote.discountType) {
		payload.discountType = draft.discountType as DiscountTypeEnum;
	}

	payload.items = draft.items.filter((i) => !i._removed).map(editableToQuoteItem);

	return payload;
}
