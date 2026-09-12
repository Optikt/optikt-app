import {
	PurchaseDiscountType,
	PurchaseDocumentType,
	PurchaseOrderItemType,
	PurchasePaymentTerms,
	PurchaseSourceCurrency,
	type CurrencyCode
} from '$lib/shared/enums';
import { getCachedLensItems, getCachedProducts } from '../../sales/catalogCache.svelte';
import {
	canPersistPurchaseOrderDraft,
	getDraftItemZeroValueFields,
	getPurchaseOrderReviewStatus
} from '../purchaseOrderDraft';
import type {
	PurchaseOrderDiscountInput,
	PurchaseOrderDraftItem,
	PurchaseOrderDraftZeroValueField
} from '../purchaseOrderDraft';
import { sourceCurrencyRequiresRateToVes } from '$lib/shared/purchaseOrderCurrencies';

export interface ZeroValueWarningLine {
	id: string;
	title: string;
	quantity: number;
	unitPurchasePrice: number;
	unitSalePrice: number;
	fields: PurchaseOrderDraftZeroValueField[];
}

export interface UnreviewedWarningLine {
	id: string;
	title: string;
	quantity: number;
}

export function getDraftItemTitle(item: PurchaseOrderDraftItem): string {
	if (item.itemType === PurchaseOrderItemType.PRODUCT) {
		const product = getCachedProducts().find((candidate) => candidate.id === item.productId);
		return product ? `${product.sku} - ${product.name}` : 'Producto seleccionado';
	}

	const lensItem = getCachedLensItems().find(
		(candidate) => candidate.id === item.lensCatalogItemId
	);
	return lensItem ? lensItem.name : 'Lente seleccionado';
}

export function getItemSku(item: PurchaseOrderDraftItem): string {
	if (item.itemType === PurchaseOrderItemType.PRODUCT) {
		const product = getCachedProducts().find((candidate) => candidate.id === item.productId);
		return product?.sku ?? '';
	}
	const lensItem = getCachedLensItems().find(
		(candidate) => candidate.id === item.lensCatalogItemId
	);
	return lensItem?.material?.name ?? '';
}

export function buildZeroValueWarningLine(
	item: PurchaseOrderDraftItem
): ZeroValueWarningLine | null {
	const fields = getDraftItemZeroValueFields(item);

	if (fields.length === 0) return null;

	return {
		id: item.id,
		title: getDraftItemTitle(item),
		quantity: Number(item.quantity || 0),
		unitPurchasePrice: Number(item.unitPurchasePrice || 0),
		unitSalePrice: Number(item.unitSalePrice || 0),
		fields
	};
}

export function buildUnreviewedWarningLine(item: PurchaseOrderDraftItem): UnreviewedWarningLine {
	return {
		id: item.id,
		title: getDraftItemTitle(item),
		quantity: Number(item.quantity || 0)
	};
}

export interface StepValidationInput {
	supplierId: string;
	orderDate: string;
	bcvRate: number;
	notes: string;
	settlementCurrency: string;
	documentType: PurchaseDocumentType;
	invoiceNumber: string;
	deliveryNoteNumber: string;
	paymentTerms: PurchasePaymentTerms;
	creditDueDate: string | null;
	discountType: PurchaseDiscountType;
	discountValue: number;
	sourceCurrency: string;
	sourceRateToVes: number;
	items: PurchaseOrderDraftItem[];
}

export function isStepValid(step: number, input: StepValidationInput): boolean {
	switch (step) {
		case 1:
			return (
				Boolean(input.supplierId) &&
				Boolean(input.orderDate) &&
				Number(input.bcvRate) > 0 &&
				String(input.notes ?? '').trim().length >= 6 &&
				Boolean(input.settlementCurrency) &&
				(input.documentType === PurchaseDocumentType.INVOICE
					? (input.invoiceNumber ?? '').length >= 2
					: (input.deliveryNoteNumber ?? '').length >= 2) &&
				(input.paymentTerms === PurchasePaymentTerms.CONTADO || Boolean(input.creditDueDate)) &&
				(input.discountType === PurchaseDiscountType.NONE || Number(input.discountValue) > 0) &&
				(!sourceCurrencyRequiresRateToVes(input.sourceCurrency) ||
					Number(input.sourceRateToVes) > 0)
			);
		case 2:
			return input.items.length > 0 && getPurchaseOrderReviewStatus(input.items).allReviewed;
		case 3:
			return true;
		default:
			return false;
	}
}

export function buildWarningLines(items: PurchaseOrderDraftItem[]): {
	unreviewed: UnreviewedWarningLine[];
	zeroValue: ZeroValueWarningLine[];
} {
	return {
		unreviewed: items.filter((item) => !item.isReviewed).map(buildUnreviewedWarningLine),
		zeroValue: items
			.map(buildZeroValueWarningLine)
			.filter((line): line is ZeroValueWarningLine => line !== null)
	};
}

export function hasDraftWarnings(items: PurchaseOrderDraftItem[]): boolean {
	return (
		items.some((item) => !item.isReviewed) ||
		items.some((item) => buildZeroValueWarningLine(item) !== null)
	);
}

export interface SaveEligibilityInput {
	header: {
		supplierId: string;
		orderDate: string;
		bcvRate: number;
		notes: string;
		sourceCurrency: string;
		sourceRateToVes: number;
	};
	items: PurchaseOrderDraftItem[];
	terms: {
		paymentTerms: PurchasePaymentTerms;
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
	};
}

export function canSavePurchaseOrder(input: SaveEligibilityInput): boolean {
	return canPersistPurchaseOrderDraft(input.header, input.items, input.terms);
}

export function buildItemsPayload(items: PurchaseOrderDraftItem[], sourceCurrency: string) {
	return items.map((item) => ({
		id: item.persistedId,
		itemType: item.itemType,
		productId:
			item.itemType === PurchaseOrderItemType.PRODUCT ? item.productId || undefined : undefined,
		lensCatalogItemId:
			item.itemType === PurchaseOrderItemType.LENS
				? item.lensCatalogItemId || undefined
				: undefined,
		quantity: item.quantity,
		unitPurchasePrice: item.unitPurchasePrice,
		unitPurchasePriceAlt:
			sourceCurrency !== PurchaseSourceCurrency.USD ? (item.unitPurchasePriceAlt ?? 0) : undefined,
		unitSalePrice: item.unitSalePrice,
		isZeroPriceIntentional: item.isZeroPriceIntentional,
		appliesIva: item.appliesIva,
		ivaRate: item.ivaRate,
		isReviewed: item.isReviewed
	}));
}

export interface PurchaseOrderPayloadInput {
	supplierId: string;
	documentType: PurchaseDocumentType;
	invoiceNumber: string;
	deliveryNoteNumber: string;
	orderDate: string;
	bcvRate: number;
	sourceCurrency: string;
	sourceRateToVes: number;
	settlementCurrency: string;
	paymentTerms: PurchasePaymentTerms;
	creditDueDate: string | null;
	earlyPaymentDiscountPercent: number | null;
	earlyPaymentDiscountDeadline: string | null;
	notes: string;
	discount: PurchaseOrderDiscountInput;
	discountNotes: string;
	items: PurchaseOrderDraftItem[];
}

export function buildPurchaseOrderPayload(input: PurchaseOrderPayloadInput) {
	return {
		supplierId: input.supplierId,
		documentType: input.documentType,
		invoiceNumber: input.invoiceNumber || undefined,
		deliveryNoteNumber: input.deliveryNoteNumber || undefined,
		orderDate: input.orderDate,
		bcvRate: input.bcvRate,
		altRate: sourceCurrencyRequiresRateToVes(input.sourceCurrency)
			? input.sourceRateToVes
			: undefined,
		sourceCurrency: input.sourceCurrency,
		settlementCurrency: input.settlementCurrency as CurrencyCode,
		paymentTerms: input.paymentTerms,
		creditDueDate: input.creditDueDate,
		earlyPaymentDiscountPercent: input.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: input.earlyPaymentDiscountDeadline,
		notes: input.notes,
		discount: {
			type: input.discount.type,
			value: input.discount.value,
			notes: input.discountNotes ? input.discountNotes : undefined
		},
		items: buildItemsPayload(input.items, input.sourceCurrency)
	};
}
