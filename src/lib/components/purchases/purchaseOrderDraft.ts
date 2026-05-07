import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { PurchaseDocumentType, PurchaseOrderItemType } from '$lib/shared/enums';
import { LensPriceType } from '$lib/shared/enums/lensTypes';
import {
	isPurchaseOrderDraftReady,
	validatePurchaseOrderDraftReadiness,
	type PurchaseOrderDraftHeaderRulesInput,
	type PurchaseOrderDraftReadinessResult
} from '$lib/shared/purchaseOrderRules';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

export interface PurchaseOrderDraftItem {
	id: string;
	persistedId?: string;
	itemType: PurchaseOrderItemType;
	productId: string;
	lensCatalogItemId: string;
	quantity: number;
	unitPurchasePrice: number;
	unitSalePrice: number;
	appliesIva: boolean;
	ivaRate: number;
	/** Per-line "data filled" / review check. New rows start as false. */
	isReviewed: boolean;
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

export interface PurchaseOrderReviewStatus {
	totalCount: number;
	reviewedCount: number;
	pendingCount: number;
	allReviewed: boolean;
}

export type PurchaseOrderDraftZeroValueField = 'unitPurchasePrice' | 'unitSalePrice';

export interface PurchaseOrderDraftHeader extends PurchaseOrderDraftHeaderRulesInput {
	documentType: PurchaseDocumentType;
	invoiceNumber: string;
	deliveryNoteNumber: string;
}

export interface PurchaseOrderDraftInitialValues extends PurchaseOrderDraftHeader {
	items: PurchaseOrderDraftItem[];
}

export function createEmptyPurchaseOrderDraftItem(
	itemType: PurchaseOrderItemType = PurchaseOrderItemType.PRODUCT,
	documentType: PurchaseDocumentType = PurchaseDocumentType.INVOICE,
	defaultTaxRate: number = DEFAULT_TAX_RATE
): PurchaseOrderDraftItem {
	const isInvoice = documentType === PurchaseDocumentType.INVOICE;

	return {
		id: crypto.randomUUID(),
		itemType,
		productId: '',
		lensCatalogItemId: '',
		quantity: 1,
		unitPurchasePrice: 0,
		unitSalePrice: 0,
		appliesIva: isInvoice,
		ivaRate: defaultTaxRate,
		isReviewed: false
	};
}

export function createPurchaseOrderDraftItemFromExisting(
	item: PurchaseOrderItemWithProduct
): PurchaseOrderDraftItem {
	return {
		id: item.id,
		persistedId: item.id,
		itemType: item.itemType as PurchaseOrderItemType,
		productId: item.productId ?? '',
		lensCatalogItemId: item.lensCatalogItemId ?? '',
		quantity: item.quantity,
		unitPurchasePrice: item.unitPurchasePrice,
		unitSalePrice: item.unitSalePrice,
		appliesIva: item.appliesIva,
		ivaRate: item.ivaRate,
		isReviewed: item.isReviewed ?? false
	};
}

export function resetDraftItemType(
	item: PurchaseOrderDraftItem,
	itemType: PurchaseOrderItemType,
	documentType: PurchaseDocumentType = PurchaseDocumentType.INVOICE,
	defaultTaxRate: number = DEFAULT_TAX_RATE
): PurchaseOrderDraftItem {
	const isInvoice = documentType === PurchaseDocumentType.INVOICE;

	item.itemType = itemType;
	item.productId = '';
	item.lensCatalogItemId = '';
	item.quantity = Math.max(item.quantity || 1, 1);
	item.unitPurchasePrice = 0;
	item.unitSalePrice = 0;
	item.appliesIva = isInvoice;
	item.ivaRate = defaultTaxRate;
	item.isReviewed = false;

	return item;
}

export function applyProductDefaults(
	item: PurchaseOrderDraftItem,
	product: ProductWithRelations,
	documentType: PurchaseDocumentType = PurchaseDocumentType.INVOICE,
	defaultTaxRate: number = DEFAULT_TAX_RATE
): PurchaseOrderDraftItem {
	const isInvoice = documentType === PurchaseDocumentType.INVOICE;
	const preTax = Number(product.currentPurchasePrice ?? 0);
	const rate = defaultTaxRate;
	const taxable = isInvoice ? product.isTaxable : false;

	item.itemType = PurchaseOrderItemType.PRODUCT;
	item.productId = product.id;
	item.lensCatalogItemId = '';
	item.unitPurchasePrice = taxable ? round2(preTax * (1 + rate / 100)) : preTax;
	item.unitSalePrice = Number(product.currentSalePrice ?? 0);
	item.appliesIva = taxable;
	item.ivaRate = rate;
	item.isReviewed = false;

	return item;
}

export function applyLensDefaults(
	item: PurchaseOrderDraftItem,
	lens: LensCatalogItemWithRelations,
	documentType: PurchaseDocumentType = PurchaseDocumentType.INVOICE,
	defaultTaxRate: number = DEFAULT_TAX_RATE
): PurchaseOrderDraftItem {
	const isInvoice = documentType === PurchaseDocumentType.INVOICE;
	const preTax = Number(
		lens.priceType === LensPriceType.PAIR ? lens.pairPurchasePrice : lens.basePrice
	);
	const rate = defaultTaxRate;
	const taxable = isInvoice ? lens.isTaxable : false;

	item.itemType = PurchaseOrderItemType.LENS;
	item.lensCatalogItemId = lens.id;
	item.productId = '';
	item.unitPurchasePrice = taxable ? round2(preTax * (1 + rate / 100)) : preTax;
	item.unitSalePrice = Number(lens.salePrice ?? 0);
	item.appliesIva = taxable;
	item.ivaRate = rate;
	item.isReviewed = false;

	return item;
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function getPreTaxUnitPrice(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva || !item.ivaRate) return item.unitPurchasePrice;
	return item.unitPurchasePrice / (1 + item.ivaRate / 100);
}

export function calculateUnitPurchasePriceFromLineTotal(
	lineTotal: number,
	quantity: number
): number {
	const normalizedTotal = Number(lineTotal || 0);
	const normalizedQuantity = Number(quantity || 0);

	if (!Number.isFinite(normalizedTotal) || normalizedTotal < 0) return 0;
	if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return 0;

	return normalizedTotal / normalizedQuantity;
}

export function getDraftItemZeroValueFields(
	item: PurchaseOrderDraftItem
): PurchaseOrderDraftZeroValueField[] {
	const fields: PurchaseOrderDraftZeroValueField[] = [];

	if (Number(item.unitPurchasePrice || 0) === 0) {
		fields.push('unitPurchasePrice');
	}

	if (Number(item.unitSalePrice || 0) === 0) {
		fields.push('unitSalePrice');
	}

	return fields;
}

export function isDraftItemConfigured(item: PurchaseOrderDraftItem): boolean {
	if (item.itemType === PurchaseOrderItemType.PRODUCT) {
		return item.productId !== '';
	}

	return item.lensCatalogItemId !== '';
}

export function validatePurchaseOrderDraft(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftItem[]
): PurchaseOrderDraftReadinessResult {
	return validatePurchaseOrderDraftReadiness(header, items);
}

export function canPersistPurchaseOrderDraft(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftItem[]
): boolean {
	return isPurchaseOrderDraftReady(header, items);
}

export function getPurchaseOrderReviewStatus(
	items: { isReviewed: boolean }[]
): PurchaseOrderReviewStatus {
	const reviewedCount = items.filter((item) => item.isReviewed).length;
	const totalCount = items.length;

	return {
		totalCount,
		reviewedCount,
		pendingCount: totalCount - reviewedCount,
		allReviewed: totalCount > 0 && reviewedCount === totalCount
	};
}

export function calculateDraftItemSubtotal(item: PurchaseOrderDraftItem): number {
	return getPreTaxUnitPrice(item) * Number(item.quantity || 0);
}

export function calculateDraftItemTax(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva) return 0;
	return calculateDraftItemSubtotal(item) * (Number(item.ivaRate || 0) / 100);
}

export function calculateDraftItemTotal(item: PurchaseOrderDraftItem): number {
	return Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0);
}

export function calculatePurchaseOrderSummary(
	items: PurchaseOrderDraftItem[]
): PurchaseOrderSummary {
	const subtotal = items.reduce((sum, item) => sum + calculateDraftItemSubtotal(item), 0);
	const taxAmount = items.reduce((sum, item) => sum + calculateDraftItemTax(item), 0);
	const total = items.reduce((sum, item) => sum + calculateDraftItemTotal(item), 0);
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
