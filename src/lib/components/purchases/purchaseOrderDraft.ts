import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import {
	PurchaseDiscountType,
	PurchaseDocumentType,
	PurchaseOrderItemType,
	PurchasePaymentTerms
} from '$lib/shared/enums';
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
	/** Price in the source currency (Bs or EUR) before IVA — set when not USD mode */
	unitPurchasePriceAlt?: number;
	unitSalePrice: number;
	isZeroPriceIntentional: boolean;
	appliesIva: boolean;
	ivaRate: number;
	/** Per-line "data filled" / review check. New rows start as false. */
	isReviewed: boolean;
}

export interface PurchaseOrderSummary {
	lineCount: number;
	totalUnits: number;
	/** Gross pre-tax subtotal — matches the delivery note. */
	subtotal: number;
	/** Gross IVA (no discount applied). */
	taxAmount: number;
	/** Gross total = subtotal + taxAmount. Matches the delivery note. */
	total: number;
	/** Gross pre-tax subtotal in alt currency (VES or EUR) when direct alt prices are available. */
	subtotalAlt?: number;
	/** Gross IVA in alt currency when direct alt prices are available. */
	taxAmountAlt?: number;
	/** Gross total in alt currency when direct alt prices are available. */
	totalAlt?: number;
	estimatedSale: number;
	estimatedProfit: number;
	/** Settlement discount applied to the gross subtotal (0 when type=NONE). */
	discountAmount: number;
	/** Settlement discount in the source currency when alt prices are available. */
	discountAmountAlt?: number;
	/** Net pre-tax base after discount = subtotal - discountAmount. */
	netSubtotal: number;
	/** IVA recomputed on the net base (per-line, respects appliesIva). */
	netTaxAmount: number;
	/** Net total (what the fiscal invoice charges). */
	netTotal: number;
	/** Net pre-tax subtotal in alt currency when direct alt prices are available. */
	netSubtotalAlt?: number;
	/** Net IVA in alt currency when direct alt prices are available. */
	netTaxAmountAlt?: number;
	/** Net total in alt currency when direct alt prices are available. */
	netTotalAlt?: number;
	/** Estimated profit using net cost. */
	netEstimatedProfit: number;
}

export interface PurchaseOrderDiscountInput {
	type: PurchaseDiscountType;
	value: number;
}

export const NO_PURCHASE_ORDER_DISCOUNT: PurchaseOrderDiscountInput = {
	type: PurchaseDiscountType.NONE,
	value: 0
};

export interface PurchaseOrderReviewStatus {
	totalCount: number;
	reviewedCount: number;
	pendingCount: number;
	allReviewed: boolean;
}

export interface PurchaseOrderCreditTermsValidationResult {
	isValid: boolean;
	issues: string[];
}

export interface PurchaseOrderDraftFinanceInput {
	paymentTerms: PurchasePaymentTerms;
	creditDueDate: string | null;
	earlyPaymentDiscountPercent: number | null;
	earlyPaymentDiscountDeadline: string | null;
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
	settlementRateToVes?: number | null;
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

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

function isIsoDateOnly(value: string | null | undefined): value is string {
	if (!value) return false;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
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



export function calculateUnitPurchasePriceAltFromLineTotal(
	lineTotalAlt: number,
	quantity: number,
	appliesIva: boolean,
	ivaRate: number
): number {
	const unitPurchasePriceWithTaxAlt = calculateUnitPurchasePriceFromLineTotal(
		lineTotalAlt,
		quantity
	);

	if (!appliesIva || !ivaRate) return round2(unitPurchasePriceWithTaxAlt);

	return round2(unitPurchasePriceWithTaxAlt / (1 + Number(ivaRate || 0) / 100));
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

export function validatePurchaseOrderDraft(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftItem[],
	finance?: PurchaseOrderDraftFinanceInput
): PurchaseOrderDraftReadinessResult {
	const readiness = validatePurchaseOrderDraftReadiness(header, items);
	if (!finance) return readiness;

	const creditTerms = validateCreditTerms(
		finance.paymentTerms,
		finance.creditDueDate,
		finance.earlyPaymentDiscountPercent,
		finance.earlyPaymentDiscountDeadline
	);

	return {
		isReady: readiness.isReady && creditTerms.isValid,
		issues: [...readiness.issues, ...creditTerms.issues]
	};
}

export function canPersistPurchaseOrderDraft(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftItem[],
	finance?: PurchaseOrderDraftFinanceInput
): boolean {
	if (!finance) {
		return isPurchaseOrderDraftReady(header, items);
	}

	return validatePurchaseOrderDraft(header, items, finance).isReady;
}

export function validateCreditTerms(
	paymentTerms: PurchasePaymentTerms,
	creditDueDate: string | null,
	earlyPaymentDiscountPercent: number | null,
	earlyPaymentDiscountDeadline: string | null
): PurchaseOrderCreditTermsValidationResult {
	const issues: string[] = [];

	if (paymentTerms === PurchasePaymentTerms.CONTADO) {
		if (
			creditDueDate ||
			Number(earlyPaymentDiscountPercent ?? 0) > 0 ||
			earlyPaymentDiscountDeadline
		) {
			issues.push('Las órdenes de contado no deben tener términos de crédito');
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}

	if (!isIsoDateOnly(creditDueDate)) {
		issues.push('Debes indicar una fecha de vencimiento válida para el crédito');
	}

	const discountPercent = Number(earlyPaymentDiscountPercent ?? 0);
	const hasDiscountPercent = discountPercent > 0;
	const hasDiscountDeadline = Boolean(earlyPaymentDiscountDeadline);

	if (hasDiscountPercent && !isIsoDateOnly(earlyPaymentDiscountDeadline)) {
		issues.push('La fecha límite de pronto pago es obligatoria');
	}

	if (hasDiscountDeadline && !hasDiscountPercent) {
		issues.push('El porcentaje de pronto pago es obligatorio');
	}

	if (hasDiscountPercent && discountPercent > 100) {
		issues.push('El porcentaje de pronto pago no puede superar 100');
	}

	if (
		isIsoDateOnly(earlyPaymentDiscountDeadline) &&
		isIsoDateOnly(creditDueDate) &&
		earlyPaymentDiscountDeadline > creditDueDate
	) {
		issues.push('La fecha de pronto pago no puede ser posterior al vencimiento');
	}

	return {
		isValid: issues.length === 0,
		issues
	};
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

export function isDraftItemUserEditingLocked(item: { isReviewed: boolean }): boolean {
	return item.isReviewed;
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

export function calculateDraftItemSubtotalAlt(item: PurchaseOrderDraftItem): number {
	const unitPriceVes = Number(item.unitPurchasePriceAlt ?? 0);
	const quantity = Number(item.quantity || 0);

	if (!Number.isFinite(unitPriceVes) || unitPriceVes < 0) return 0;
	if (!Number.isFinite(quantity) || quantity <= 0) return 0;

	return round2(unitPriceVes * quantity);
}

export function calculateDraftItemTaxAlt(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva) return 0;
	return round2(calculateDraftItemSubtotalAlt(item) * (Number(item.ivaRate || 0) / 100));
}

export function calculateDraftItemTotalAlt(item: PurchaseOrderDraftItem): number {
	return round2(calculateDraftItemSubtotalAlt(item) + calculateDraftItemTaxAlt(item));
}

function hasDirectAltPrice(item: PurchaseOrderDraftItem): boolean {
	return item.unitPurchasePriceAlt !== undefined && item.unitPurchasePriceAlt !== null;
}

function calculateNetDraftItemSubtotalAlt(item: PurchaseOrderDraftItem, factor: number): number {
	return round2(calculateDraftItemSubtotalAlt(item) * factor);
}

function calculateNetDraftItemTaxAlt(item: PurchaseOrderDraftItem, factor: number): number {
	if (!item.appliesIva) return 0;
	return round2(calculateNetDraftItemSubtotalAlt(item, factor) * (Number(item.ivaRate || 0) / 100));
}

/**
 * Returns the USD discount amount applied to a gross subtotal.
 * - PERCENT: subtotal × value / 100 (capped 0..100 by validation upstream).
 * - AMOUNT: min(value, subtotal) so we never go negative.
 * - NONE / unknown: 0.
 */
export function applySettlementDiscount(
	subtotalGross: number,
	discount: PurchaseOrderDiscountInput | null | undefined
): number {
	if (!discount) return 0;
	const gross = Number(subtotalGross || 0);
	if (gross <= 0) return 0;
	const value = Number(discount.value || 0);
	if (value <= 0) return 0;
	if (discount.type === PurchaseDiscountType.PERCENT) {
		return round2((gross * Math.min(value, 100)) / 100);
	}
	if (discount.type === PurchaseDiscountType.AMOUNT) {
		return round2(Math.min(value, gross));
	}
	return 0;
}

/**
 * Returns the multiplicative factor that converts gross prices to net prices.
 * factor = (subtotalGross - discountAmount) / subtotalGross, clamped to [0, 1].
 * Returns 1 when there is no discount (or subtotal is zero).
 */
export function getSettlementDiscountFactor(
	subtotalGross: number,
	discount: PurchaseOrderDiscountInput | null | undefined
): number {
	const gross = Number(subtotalGross || 0);
	if (gross <= 0) return 1;
	const discountAmount = applySettlementDiscount(gross, discount);
	if (discountAmount <= 0) return 1;
	const factor = (gross - discountAmount) / gross;
	if (!Number.isFinite(factor)) return 1;
	return Math.max(0, Math.min(1, factor));
}

/**
 * Prorates the per-unit gross purchase price into the per-unit net price.
 * Same factor applies whether `unitPurchasePrice` is pre-tax or tax-included,
 * because the discount scales the pre-tax cost and IVA scales linearly with it.
 */
export function prorateNetUnitPurchasePrice(grossUnitPrice: number, factor: number): number {
	return round2(Number(grossUnitPrice || 0) * factor);
}

export function calculatePurchaseOrderSummary(
	items: PurchaseOrderDraftItem[],
	discount: PurchaseOrderDiscountInput | null | undefined = NO_PURCHASE_ORDER_DISCOUNT,
	bcvRate?: number
): PurchaseOrderSummary {
	const subtotal = items.reduce((sum, item) => sum + calculateDraftItemSubtotal(item), 0);
	const taxAmount = items.reduce((sum, item) => sum + calculateDraftItemTax(item), 0);
	const total = items.reduce((sum, item) => sum + calculateDraftItemTotal(item), 0);
	void bcvRate;
	const shouldCalculateAltTotals = items.some(hasDirectAltPrice);
	const subtotalAlt = shouldCalculateAltTotals
		? round2(items.reduce((sum, item) => sum + calculateDraftItemSubtotalAlt(item), 0))
		: undefined;
	const taxAmountAlt = shouldCalculateAltTotals
		? round2(items.reduce((sum, item) => sum + calculateDraftItemTaxAlt(item), 0))
		: undefined;
	const totalAlt = shouldCalculateAltTotals
		? round2(items.reduce((sum, item) => sum + calculateDraftItemTotalAlt(item), 0))
		: undefined;
	const estimatedSale = items.reduce(
		(sum, item) => sum + Number(item.unitSalePrice || 0) * Number(item.quantity || 0),
		0
	);

	// Apply discount in source currency when alt prices exist and discount is AMOUNT
	const discountBase =
		shouldCalculateAltTotals &&
		discount?.type === PurchaseDiscountType.AMOUNT &&
		(subtotalAlt ?? 0) > 0
			? subtotalAlt!
			: subtotal;
	const discountAmount = applySettlementDiscount(discountBase, discount);
	const factor = getSettlementDiscountFactor(discountBase, discount);
	// Discount in source currency (for display alongside source-currency amounts)
	const discountAmountAlt =
		discountBase !== subtotal ? round2(discountBase - discountBase * factor) : discountAmount;
	const netSubtotal = round2(subtotal - subtotal * (1 - factor));
	const netTaxAmount = items.reduce((sum, item) => sum + calculateDraftItemTax(item) * factor, 0);
	const netTotal = round2(netSubtotal + netTaxAmount);
	const netSubtotalAlt = shouldCalculateAltTotals && subtotalAlt != null
		? round2(subtotalAlt * factor)
		: undefined;
	const netTaxAmountAlt = shouldCalculateAltTotals && taxAmountAlt != null
		? round2(taxAmountAlt * factor)
		: undefined;
	const netTotalAlt =
		netSubtotalAlt !== undefined && netTaxAmountAlt !== undefined
			? round2(netSubtotalAlt + netTaxAmountAlt)
			: undefined;

	return {
		lineCount: items.length,
		totalUnits: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		subtotal,
		taxAmount,
		total,
		subtotalAlt,
		taxAmountAlt,
		totalAlt,
		estimatedSale,
		estimatedProfit: estimatedSale - total,
		discountAmount,
		discountAmountAlt: shouldCalculateAltTotals ? discountAmountAlt : undefined,
		netSubtotal,
		netTaxAmount: round2(netTaxAmount),
		netTotal,
		netSubtotalAlt,
		netTaxAmountAlt,
		netTotalAlt,
		netEstimatedProfit: estimatedSale - netTotal
	};
}
