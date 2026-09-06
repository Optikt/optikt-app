/**
 * Purchase order draft item defaults + factories.
 * Pure functions that create/reset draft rows and hydrate defaults.
 */

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import {
	PurchaseDocumentType,
	PurchaseOrderItemType,
	PurchasePaymentTerms
} from '$lib/shared/enums';
import { LensPriceType } from '$lib/shared/enums/lensTypes';
import type { PurchaseOrderDraftHeaderRulesInput } from '$lib/shared/purchaseOrderRules';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

import type { PurchaseOrderDiscountInput } from './summary';

export interface PurchaseOrderDraftItem {
	id: string;
	persistedId?: string;
	itemType: PurchaseOrderItemType;
	productId: string;
	lensCatalogItemId: string;
	quantity: number;
	unitPurchasePrice: number;
	/** Price in the source currency (Bs or EUR) before IVA — set when not USD mode */
	unitPurchasePriceAlt?: number;
	unitSalePrice: number;
	isZeroPriceIntentional: boolean;
	appliesIva: boolean;
	ivaRate: number;
	/** Per-line "data filled" / review check. New rows start as false. */
	isReviewed: boolean;
}

export type PurchaseOrderDraftZeroValueField = 'unitPurchasePrice' | 'unitSalePrice';

export interface PurchaseOrderDraftHeader extends PurchaseOrderDraftHeaderRulesInput {
	documentType: PurchaseDocumentType;
	invoiceNumber: string;
	deliveryNoteNumber: string;
	paymentTerms: PurchasePaymentTerms;
	creditDueDate: string | null;
	earlyPaymentDiscountPercent: number | null;
	earlyPaymentDiscountDeadline: string | null;
	discount?: PurchaseOrderDiscountInput;
	discountNotes?: string | null;
}

export interface PurchaseOrderDraftInitialValues extends PurchaseOrderDraftHeader {
	items: PurchaseOrderDraftItem[];
	sourceCurrency?: string;
	sourceRateToVes?: number | null;
	settlementCurrency?: string;
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
		unitPurchasePriceAlt: undefined,
		unitSalePrice: 0,
		isZeroPriceIntentional: false,
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
		unitPurchasePriceAlt: item.unitPurchasePriceAlt ?? undefined,
		unitSalePrice: item.unitSalePrice,
		isZeroPriceIntentional: item.isZeroPriceIntentional ?? false,
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
	item.unitPurchasePriceAlt = undefined;
	item.unitSalePrice = 0;
	item.isZeroPriceIntentional = false;
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
	item.unitPurchasePriceAlt = undefined;
	item.unitSalePrice = Number(product.currentSalePrice ?? 0);
	item.isZeroPriceIntentional = false;
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
	item.unitPurchasePriceAlt = undefined;
	item.unitSalePrice = Number(lens.salePrice ?? 0);
	item.isZeroPriceIntentional = false;
	item.appliesIva = taxable;
	item.ivaRate = rate;
	item.isReviewed = false;

	return item;
}

export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function getDraftItemZeroValueFields(
	item: PurchaseOrderDraftItem
): PurchaseOrderDraftZeroValueField[] {
	if (item.isZeroPriceIntentional) {
		return [];
	}

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
