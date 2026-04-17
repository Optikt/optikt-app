import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { PurchaseOrderItemType } from '$lib/shared/enums';
import { LensPriceType } from '$lib/shared/enums/lensTypes';

export interface PurchaseOrderDraftItem {
	id: string;
	itemType: PurchaseOrderItemType;
	productId: string;
	lensCatalogItemId: string;
	quantity: number;
	unitPurchasePrice: number;
	unitSalePrice: number;
	appliesIva: boolean;
	ivaRate: number;
}

export interface PurchaseOrderSummary {
	lineCount: number;
	totalUnits: number;
	subtotal: number;
	taxAmount: number;
	total: number;
	estimatedSale: number;
	estimatedProfit: number;
}

export function createEmptyPurchaseOrderDraftItem(
	itemType: PurchaseOrderItemType = PurchaseOrderItemType.PRODUCT
): PurchaseOrderDraftItem {
	return {
		id: crypto.randomUUID(),
		itemType,
		productId: '',
		lensCatalogItemId: '',
		quantity: 1,
		unitPurchasePrice: 0,
		unitSalePrice: 0,
		appliesIva: itemType === PurchaseOrderItemType.PRODUCT,
		ivaRate: 16
	};
}

export function resetDraftItemType(
	item: PurchaseOrderDraftItem,
	itemType: PurchaseOrderItemType
): PurchaseOrderDraftItem {
	item.itemType = itemType;
	item.productId = '';
	item.lensCatalogItemId = '';
	item.quantity = Math.max(item.quantity || 1, 1);
	item.unitPurchasePrice = 0;
	item.unitSalePrice = 0;
	item.appliesIva = itemType === PurchaseOrderItemType.PRODUCT;
	item.ivaRate = 16;

	return item;
}

export function applyProductDefaults(
	item: PurchaseOrderDraftItem,
	product: ProductWithRelations
): PurchaseOrderDraftItem {
	item.itemType = PurchaseOrderItemType.PRODUCT;
	item.productId = product.id;
	item.lensCatalogItemId = '';
	item.unitPurchasePrice = Number(product.currentPurchasePrice ?? 0);
	item.unitSalePrice = Number(product.currentSalePrice ?? 0);
	item.appliesIva = product.isTaxable;
	item.ivaRate = Number(product.taxRate ?? 16);

	return item;
}

export function applyLensDefaults(
	item: PurchaseOrderDraftItem,
	lens: LensCatalogItemWithRelations
): PurchaseOrderDraftItem {
	item.itemType = PurchaseOrderItemType.LENS;
	item.lensCatalogItemId = lens.id;
	item.productId = '';
	item.unitPurchasePrice = Number(
		lens.priceType === LensPriceType.PAIR ? lens.pairPurchasePrice : lens.basePrice
	);
	item.unitSalePrice = Number(lens.salePrice ?? 0);
	item.appliesIva = lens.isTaxable;
	item.ivaRate = Number(lens.taxRate ?? 16);

	return item;
}

export function isDraftItemConfigured(item: PurchaseOrderDraftItem): boolean {
	if (item.itemType === PurchaseOrderItemType.PRODUCT) {
		return item.productId !== '';
	}

	return item.lensCatalogItemId !== '';
}

export function calculateDraftItemSubtotal(item: PurchaseOrderDraftItem): number {
	return Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0);
}

export function calculateDraftItemTax(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva) return 0;

	return calculateDraftItemSubtotal(item) * (Number(item.ivaRate || 0) / 100);
}

export function calculateDraftItemTotal(item: PurchaseOrderDraftItem): number {
	return calculateDraftItemSubtotal(item) + calculateDraftItemTax(item);
}

export function calculatePurchaseOrderSummary(
	items: PurchaseOrderDraftItem[]
): PurchaseOrderSummary {
	const subtotal = items.reduce((sum, item) => sum + calculateDraftItemSubtotal(item), 0);
	const taxAmount = items.reduce((sum, item) => sum + calculateDraftItemTax(item), 0);
	const total = subtotal + taxAmount;
	const estimatedSale = items.reduce(
		(sum, item) => sum + Number(item.unitSalePrice || 0) * Number(item.quantity || 0),
		0
	);

	return {
		lineCount: items.length,
		totalUnits: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		subtotal,
		taxAmount,
		total,
		estimatedSale,
		estimatedProfit: estimatedSale - total
	};
}
