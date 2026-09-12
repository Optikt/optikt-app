import { PurchaseDiscountType } from '$lib/shared/enums';
import {
	calculatePurchaseOrderSummary,
	createPurchaseOrderDraftItemFromExisting,
	type PurchaseOrderDiscountInput
} from '../purchaseOrderDraft';
import {
	getSourceCurrencySymbol,
	sourceCurrencyRequiresRateToVes
} from '$lib/shared/purchaseOrderCurrencies';
import { formatPrice } from '$lib/utils';
import { itemDisplayName } from '$lib/utils/purchaseOrderDetail';
import type {
	PurchaseOrderItemWithProduct,
	PurchaseOrderWithRelations
} from '$lib/server/db/queries/purchaseOrders';
import type { InventoryLot } from '$lib/server/db/schema';

export function buildSettlementDiscount(
	purchaseOrder: Partial<
		Pick<PurchaseOrderWithRelations, 'settlementDiscountType' | 'settlementDiscountValue'>
	>
): PurchaseOrderDiscountInput {
	return {
		type: (purchaseOrder.settlementDiscountType ??
			PurchaseDiscountType.NONE) as PurchaseDiscountType,
		value: Number(purchaseOrder.settlementDiscountValue ?? 0)
	};
}

export interface PurchaseDetailSummary {
	settlementDiscount: PurchaseOrderDiscountInput;
	hasSettlementDiscount: boolean;
	purchaseSummary: ReturnType<typeof calculatePurchaseOrderSummary>;
	totalUnits: number;
	totalPurchase: number;
	totalSale: number;
	totalProfit: number;
	netTotalPurchase: number;
	netTotalProfit: number;
	settlementDiscountAmount: number;
	settlementDiscountLabel: string;
}

export function buildPurchaseDetailSummary(
	purchaseOrder: PurchaseOrderWithRelations,
	items: PurchaseOrderItemWithProduct[]
): PurchaseDetailSummary {
	const settlementDiscount = buildSettlementDiscount(purchaseOrder);
	const hasSettlementDiscount =
		settlementDiscount.type !== PurchaseDiscountType.NONE && settlementDiscount.value > 0;
	const purchaseSummary = calculatePurchaseOrderSummary(
		items.map(createPurchaseOrderDraftItemFromExisting),
		settlementDiscount,
		purchaseOrder.bcvRate
	);
	const needsSourceRate = sourceCurrencyRequiresRateToVes(purchaseOrder.sourceCurrency);
	const srcSymbol = needsSourceRate ? getSourceCurrencySymbol(purchaseOrder.sourceCurrency) : '';

	return {
		settlementDiscount,
		hasSettlementDiscount,
		purchaseSummary,
		totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
		totalPurchase: purchaseSummary.total,
		totalSale: purchaseSummary.estimatedSale,
		totalProfit: purchaseSummary.estimatedProfit,
		netTotalPurchase: purchaseSummary.netTotal,
		netTotalProfit: purchaseSummary.netEstimatedProfit,
		settlementDiscountAmount: purchaseSummary.discountAmount,
		settlementDiscountLabel:
			settlementDiscount.type === PurchaseDiscountType.PERCENT
				? `${settlementDiscount.value}%`
				: settlementDiscount.type === PurchaseDiscountType.AMOUNT
					? needsSourceRate
						? `${srcSymbol} ${settlementDiscount.value.toFixed(2)}`
						: formatPrice(settlementDiscount.value)
					: 'Sin descuento'
	};
}

export function buildUnmarkReadyMessage(reviewedCount: number): string {
	return reviewedCount > 0
		? reviewedCount === 1
			? 'Al volver a borrador se perderá 1 check de revisión. ¿Estás seguro?'
			: `Al volver a borrador se perderán los ${reviewedCount} checks de revisión. ¿Estás seguro?`
		: 'La orden volverá a preparación para poder editarla.';
}

export interface RevertTarget {
	lotId: string;
	productName: string;
	quantity: number;
}

export function buildRevertTarget(
	item: PurchaseOrderItemWithProduct,
	lotsMap: Record<string, InventoryLot>
): RevertTarget | null {
	if (!item.lotId) return null;
	const lot = lotsMap[item.lotId];
	if (!lot) return null;

	return {
		lotId: item.lotId,
		productName: itemDisplayName(item),
		quantity: lot.quantityInitial
	};
}

export function toggleItemReviewedLocal<T extends { id: string; isReviewed?: boolean | null }>(
	items: T[],
	itemId: string,
	next: boolean
): T[] {
	return items.map((entry) => (entry.id === itemId ? { ...entry, isReviewed: next } : entry));
}
