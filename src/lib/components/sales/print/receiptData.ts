import { PaymentMethod } from '$lib/shared/enums';
import { SaleStatus } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
import type { SalePayment } from '$lib/server/db/schema';
import { computeDiscount, formatCurrency, formatDate, formatPrice } from '$lib/utils';
import { computeTaxBreakdown, type TaxableItem } from '$lib/shared/tax';
import { computeAdjustedTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
import { hasHalfLetterReceiptOverflowRisk } from '$lib/utils/printDocumentItems';

export interface RenderedRow {
	key: string;
	item: SaleItemWithDetails;
	lineTotal: number;
}

export interface ReceiptSettings {
	businessName?: string | null;
	businessLogo?: string | null;
	businessRif?: string | null;
	businessPhone?: string | null;
	businessAddress?: string | null;
}

export interface ReceiptViewModel {
	formattedOrderNumber: string;
	businessName: string;
	businessLogo: string | null;
	printLogoPrimary: string;
	printLogoSecondary: string;
	watermarkPrimary: string;
	businessRif: string | null;
	businessContactPhone: string | null;
	businessAddress: string | null;
	customerName: string;
	customerDocument: string;
	customerPhone: string | null;
	adjusted: ReturnType<typeof computeAdjustedTaxBreakdown>;
	discountOnBase: number;
	hasDiscount: boolean;
	ivaRate: number | null;
	remainingAmount: number;
	showRemainingAmount: boolean;
	showAdditionalPayments: boolean;
	renderedRows: RenderedRow[];
	halfLetterOverflowRisk: boolean;
	placeholderRows: readonly number[];
	receiptDateLabel: string;
	sellerName: string;
	saleTotal: number;
}

const defaultPlaceholderRows = [1, 2, 3] as const;
const compactPlaceholderRows = [1, 2] as const;

export function computeLineTotal(
	item: Pick<SaleItemWithDetails, 'unitPrice' | 'quantity' | 'discount' | 'discountType'>
): number {
	const gross = item.unitPrice * item.quantity;
	return gross - computeDiscount(item.discount, item.discountType, gross);
}

export function formatReceiptDate(date: Date | string | null): string {
	const formatted = formatDate(date, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	return formatted.replace(/(\b[a-záéíóúñ]{3})(?=\s\d{4}\b)/iu, (match) =>
		match.endsWith('.') ? match : `${match}.`
	);
}

export function formatOriginalPaymentAmount(payment: SalePayment): string {
	const formatted = formatCurrency(payment.amount);

	switch (payment.paymentMethod) {
		case PaymentMethod.EFECTIVO_USD:
			return formatPrice(payment.amount);
		case PaymentMethod.BINANCE_USDT:
			return `${formatted} USDT`;
		default:
			return `${formatted} Bs`;
	}
}

export function formatPaymentReceiptDate(date: Date | string | null): string {
	return formatDate(date, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
}

export function formatPaymentBcvAmount(payment: SalePayment): string {
	return `${formatPrice(payment.amountBcvUsd)} (BCV)`;
}

export function formatTaxRate(rate: number | null): string {
	if (rate === null || rate <= 0) return '';
	return new Intl.NumberFormat('es-VE', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	}).format(rate);
}

export function buildReceiptViewModel(
	sale: SaleWithRelations,
	items: SaleItemWithDetails[],
	payments: SalePayment[],
	settings: ReceiptSettings
): ReceiptViewModel {
	const formattedOrderNumber = `#${String(sale.orderNumber).padStart(4, '0')}`;
	const businessName = settings.businessName?.trim() || 'Optikt';
	const businessLogo = settings.businessLogo?.trim() || null;
	const printLogoPrimary = '#94a3b8';
	const printLogoSecondary = '#dbe3ec';
	const watermarkPrimary = '#cbd5e1';
	const businessRif = settings.businessRif?.trim() || null;
	const businessContactPhone = settings.businessPhone?.trim() || null;
	const businessAddress = settings.businessAddress?.trim() || null;
	const customerName = sale.customer
		? `${sale.customer.firstName} ${sale.customer.lastName}`
		: 'Cliente General';
	const customerDocument = sale.customer?.idNumber ?? 'No registrado';
	const customerPhone = sale.customer?.primaryPhone?.trim() || null;
	const taxItems: TaxableItem[] = items.map((item) => ({
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		discount: item.discount,
		discountType: item.discountType as 'FIXED' | 'PERCENTAGE',
		isTaxable: item.snapshotIsTaxable ?? false,
		taxRate: sale.snapshotTaxRate
	}));
	const rawSubtotal = computeTaxBreakdown(taxItems).total;
	const discountAmount = Math.max(0, rawSubtotal - sale.total);
	const adjusted = computeAdjustedTaxBreakdown(taxItems, discountAmount);
	const discountOnBase =
		adjusted.subtotalBeforeGlobal - adjusted.taxableBase - adjusted.exemptTotal;
	const hasDiscount = sale.discount > 0;
	const ivaRate = sale.snapshotTaxRate > 0 ? sale.snapshotTaxRate : null;
	const remainingAmount = Math.max(0, sale.total - sale.paidAmountBcvUsd);
	const showRemainingAmount = payments.length > 0 && remainingAmount > 0.01;
	const showAdditionalPayments = sale.status !== SaleStatus.CANCELLED;

	const treatmentGroups = items.reduce<Record<string, SaleItemWithDetails[]>>((groups, item) => {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentSaleItemId) {
			return groups;
		}

		const existing = groups[item.parentSaleItemId] ?? [];
		existing.push(item);
		groups[item.parentSaleItemId] = existing;
		return groups;
	}, {});

	const renderedRows: RenderedRow[] = items
		.filter((item: SaleItemWithDetails) => item.itemType !== SaleItemType.TREATMENT)
		.flatMap((item) => [
			{
				key: item.id,
				item,
				lineTotal: computeLineTotal(item)
			},
			...(treatmentGroups[item.id] ?? []).map((treatment) => ({
				key: treatment.id,
				item: treatment,
				lineTotal: computeLineTotal(treatment)
			}))
		]);
	const halfLetterOverflowRisk = hasHalfLetterReceiptOverflowRisk({
		itemLineCount: renderedRows.length,
		paymentCount: payments.length
	});
	const placeholderRows = halfLetterOverflowRisk ? compactPlaceholderRows : defaultPlaceholderRows;

	return {
		formattedOrderNumber,
		businessName,
		businessLogo,
		printLogoPrimary,
		printLogoSecondary,
		watermarkPrimary,
		businessRif,
		businessContactPhone,
		businessAddress,
		customerName,
		customerDocument,
		customerPhone,
		adjusted,
		discountOnBase,
		hasDiscount,
		ivaRate,
		remainingAmount,
		showRemainingAmount,
		showAdditionalPayments,
		renderedRows,
		halfLetterOverflowRisk,
		placeholderRows,
		receiptDateLabel: formatReceiptDate(sale.saleDate),
		sellerName: sale.seller?.fullName ?? 'Sin asignar',
		saleTotal: sale.total
	};
}
