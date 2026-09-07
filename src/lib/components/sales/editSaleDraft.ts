import { DiscountType } from '$lib/shared/enums';
import { FreeItemCategory, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
import type { SaleItemInput } from '$lib/schemas/sales';
import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import { computeDiscount } from '$lib/utils';

export type EditableItem = SaleItemInput & { _removed?: boolean };

export function createEmptyLensDraft(): EditableItem {
	return {
		itemType: SaleItemType.LENS_PAIR,
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		_removed: false
	};
}

export function existingItemToInput(item: SaleItemWithDetails): EditableItem {
	return {
		id: item.id,
		itemType: item.itemType,
		productId: item.productId ?? undefined,
		lensCatalogItemId: item.lensCatalogItemId ?? undefined,
		parentSaleItemId: item.parentSaleItemId ?? undefined,
		supplierTreatmentId: item.supplierTreatmentId ?? undefined,
		prescriptionId: item.prescriptionId ?? undefined,
		odSphere: item.odSphere ?? undefined,
		odCylinder: item.odCylinder ?? undefined,
		odAxis: item.odAxis ?? undefined,
		odAddition: item.odAddition ?? undefined,
		odAltura: item.odAltura ?? undefined,
		osSphere: item.osSphere ?? undefined,
		osCylinder: item.osCylinder ?? undefined,
		osAxis: item.osAxis ?? undefined,
		osAddition: item.osAddition ?? undefined,
		osAltura: item.osAltura ?? undefined,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: item.discountType as DiscountType,
		snapshotName: item.snapshotName ?? undefined,
		snapshotSku: item.snapshotSku ?? undefined,
		snapshotBrand: item.snapshotBrand ?? undefined,
		snapshotBaseCost: item.snapshotBaseCost ?? undefined,
		snapshotMountingPrice: item.snapshotMountingPrice ?? undefined,
		snapshotShippingPrice: item.snapshotShippingPrice ?? undefined,
		snapshotSalePrice: item.snapshotSalePrice ?? undefined,
		snapshotPriceType: item.snapshotPriceType ?? undefined,
		snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? undefined,
		snapshotIsTaxable: item.snapshotIsTaxable ?? undefined,
		shippingCostPending: item.shippingCostPending ?? undefined,
		freeItemCategory: (item.freeDetails?.category as FreeItemCategory) ?? undefined,
		freeItemDescription: item.freeDetails?.description ?? undefined,
		freeItemUnitCost: item.freeDetails?.unitCost ?? undefined,
		freeItemSupplierId: item.freeDetails?.supplierId ?? undefined,
		freeItemOpticalNotes: item.freeDetails?.opticalNotes ?? undefined,
		notes: item.notes ?? undefined,
		_removed: false
	};
}

export function buildLensInputFromDraft(
	editLensTmp: EditableItem,
	selectedLens: {
		name?: string;
		supplier?: { name?: string } | null;
		pairPurchasePrice?: number;
		mountingPrice?: number;
		shippingPrice?: number;
		salePrice?: number;
		priceType?: string;
		isTaxable?: boolean;
	} | null
): EditableItem {
	const lensName = selectedLens?.name ?? editLensTmp.snapshotName;
	const supplierName = selectedLens?.supplier?.name ?? editLensTmp.snapshotBrand;
	return {
		...editLensTmp,
		snapshotName: lensName,
		snapshotBrand: supplierName,
		snapshotBaseCost: selectedLens?.pairPurchasePrice ?? editLensTmp.snapshotBaseCost,
		snapshotMountingPrice: selectedLens?.mountingPrice ?? editLensTmp.snapshotMountingPrice,
		snapshotShippingPrice: editLensTmp.shippingCostPending
			? undefined
			: (selectedLens?.shippingPrice ?? editLensTmp.snapshotShippingPrice),
		snapshotSalePrice: selectedLens?.salePrice ?? editLensTmp.snapshotSalePrice,
		snapshotPriceType: selectedLens?.priceType ?? editLensTmp.snapshotPriceType,
		snapshotIsTaxable: selectedLens?.isTaxable ?? editLensTmp.snapshotIsTaxable ?? true
	};
}

export function previewSubtotalForItems(
	activeItems: EditableItem[],
	discount: number,
	discountType: string
): { subtotal: number; globalDiscount: number; total: number } {
	const subtotal = activeItems.reduce((acc, item) => {
		const lineTotal = item.unitPrice * item.quantity;
		const itemDiscount = computeDiscount(
			item.discount ?? 0,
			(item.discountType ?? DiscountType.FIXED) as DiscountTypeEnum,
			lineTotal
		);
		return acc + lineTotal - itemDiscount;
	}, 0);
	const globalDiscount = computeDiscount(
		discount ?? 0,
		(discountType ?? DiscountType.FIXED) as DiscountTypeEnum,
		subtotal
	);
	const total = Math.max(0, subtotal - globalDiscount);
	return { subtotal, globalDiscount, total };
}

export function itemDetail(item: EditableItem): string {
	const parts: string[] = [];
	if (item.snapshotSku) parts.push(item.snapshotSku);
	if (item.snapshotBrand) parts.push(item.snapshotBrand);
	if (item.itemType === SaleItemType.FREE_ITEM && item.freeItemCategory) {
		parts.push(item.freeItemCategory);
	}
	return parts.join(' · ');
}

export function hasChangesForSale(
	sale: { saleDate: string; notes: string | null; discount: number; discountType: string },
	saleDate: string,
	notes: string,
	discount: number,
	discountType: string,
	editableItems: EditableItem[]
): boolean {
	return (
		saleDate !== sale.saleDate.slice(0, 10) ||
		notes !== (sale.notes ?? '') ||
		discount !== sale.discount ||
		discountType !== sale.discountType ||
		editableItems.some((i) => i._removed) ||
		editableItems.some((i) => !i.id)
	);
}
