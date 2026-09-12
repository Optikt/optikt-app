/**
 * Purchase order query internals (private helpers).
 * Split from queries/purchaseOrders.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { PurchaseOrderFilterOptions, PurchaseOrderWithRelations } from './types';
import { eq, and, isNull, inArray, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { buildTokenSearchConditions } from '$lib/server/db/search';
import {
	purchaseOrders,
	purchaseOrderItems,
	purchaseOrderPayments,
	purchaseOrderEarlyPaymentBenefits,
	suppliers
} from '$lib/server/db/schema';

import { PurchaseOrderStatus, PurchaseDiscountType, PurchasePaymentTerms } from '$lib/shared/enums';

import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export function buildPendingBalanceCondition(): SQL {
	return sql`
		${purchaseOrders.settlementDebtAmount}
		- COALESCE((
			SELECT SUM(pop.amount_applied_to_debt)
			FROM ${purchaseOrderPayments} pop
			WHERE pop.purchase_order_id = ${purchaseOrders.id}
			  AND pop.voided_at IS NULL
		), 0)
		- COALESCE((
			SELECT SUM(poepb.amount_applied_to_debt)
			FROM ${purchaseOrderEarlyPaymentBenefits} poepb
			WHERE poepb.purchase_order_id = ${purchaseOrders.id}
			  AND poepb.applied_to_balance = true
			  AND poepb.voided_at IS NULL
		), 0)
		> 0.01
	`;
}

export function buildOverdueBalanceCondition(): SQL {
	return sql`
		${purchaseOrders.status} = ${PurchaseOrderStatus.CONFIRMED}
		AND ${purchaseOrders.paymentTerms} = ${PurchasePaymentTerms.CREDIT}
		AND ${buildPendingBalanceCondition()}
		AND ${purchaseOrders.creditDueDate} < CURRENT_DATE
	`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function poSearchConcat(): SQL {
	return sql`concat(
		cast(${purchaseOrders.orderNumber} as text), ' ',
		concat('PO-', lpad(cast(${purchaseOrders.orderNumber} as text), 4, '0')), ' ',
		coalesce(${purchaseOrders.invoiceNumber}, ''), ' ',
		coalesce(${purchaseOrders.deliveryNoteNumber}, ''), ' ',
		coalesce(${suppliers.name}, '')
	)`;
}

export function poSearchFields(): SQLWrapper[] {
	return [
		sql`cast(${purchaseOrders.orderNumber} as text)`,
		sql`concat('PO-', lpad(cast(${purchaseOrders.orderNumber} as text), 4, '0'))`,
		purchaseOrders.invoiceNumber,
		purchaseOrders.deliveryNoteNumber,
		suppliers.name
	];
}

export function buildPOConditions(opts: PurchaseOrderFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) conditions.push(isNull(purchaseOrders.deletedAt));
	if (opts.search?.trim()) {
		conditions.push(...buildTokenSearchConditions(opts.search, poSearchConcat()));
	}
	if (opts.status) conditions.push(eq(purchaseOrders.status, opts.status));
	if (opts.readyForReview !== undefined) {
		conditions.push(eq(purchaseOrders.isReadyForReview, opts.readyForReview));
	}
	if (opts.supplierId) conditions.push(eq(purchaseOrders.supplierId, opts.supplierId));
	if (opts.hasPendingBalance !== undefined) {
		const pendingCondition = buildPendingBalanceCondition();
		conditions.push(opts.hasPendingBalance ? pendingCondition : sql`NOT (${pendingCondition})`);
	}
	if (opts.hasOverdueBalance !== undefined) {
		const overdueCondition = buildOverdueBalanceCondition();
		conditions.push(opts.hasOverdueBalance ? overdueCondition : sql`NOT (${overdueCondition})`);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function addFinancialMetadata(
	rows: PurchaseOrderWithRelations[]
): Promise<PurchaseOrderWithRelations[]> {
	if (rows.length === 0) return rows;

	const purchaseOrderIds = rows.map((row) => row.id);
	const [items, payments, benefits] = await Promise.all([
		db
			.select()
			.from(purchaseOrderItems)
			.where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds)),
		db
			.select()
			.from(purchaseOrderPayments)
			.where(inArray(purchaseOrderPayments.purchaseOrderId, purchaseOrderIds)),
		db
			.select()
			.from(purchaseOrderEarlyPaymentBenefits)
			.where(inArray(purchaseOrderEarlyPaymentBenefits.purchaseOrderId, purchaseOrderIds))
	]);

	const itemsByOrderId = new Map<string, typeof items>();
	for (const item of items) {
		itemsByOrderId.set(item.purchaseOrderId, [
			...(itemsByOrderId.get(item.purchaseOrderId) ?? []),
			item
		]);
	}

	const paymentsByOrderId = new Map<string, typeof payments>();
	for (const payment of payments) {
		paymentsByOrderId.set(payment.purchaseOrderId, [
			...(paymentsByOrderId.get(payment.purchaseOrderId) ?? []),
			payment
		]);
	}

	const benefitsByOrderId = new Map<string, typeof benefits>();
	for (const benefit of benefits) {
		benefitsByOrderId.set(benefit.purchaseOrderId, [
			...(benefitsByOrderId.get(benefit.purchaseOrderId) ?? []),
			benefit
		]);
	}

	return rows.map((row) => {
		const orderItems = itemsByOrderId.get(row.id) ?? [];
		const orderPayments = paymentsByOrderId.get(row.id) ?? [];
		const orderBenefits = benefitsByOrderId.get(row.id) ?? [];
		const balance = computePurchaseOrderBalance(row, orderItems, orderPayments, orderBenefits, {
			settlementCurrency: row.settlementCurrency,
			settlementGrossAmount: row.settlementGrossAmount,
			settlementDebtAmount: row.settlementDebtAmount
		});
		const dueStatus = getPurchaseOrderDueStatus({
			paymentTerms: row.paymentTerms,
			creditDueDate: row.creditDueDate,
			earlyPaymentDiscountDeadline: row.earlyPaymentDiscountDeadline,
			balance: balance.settlementBalance
		});

		return { ...row, balance, dueStatus };
	});
}

export function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * Computes the multiplicative factor that converts each item's gross
 * `unitPurchasePrice` into the net price actually paid (after the header's
 * settlement discount). Returns 1 when there is no discount or the subtotal
 * is zero. The factor is computed against the gross pre-tax subtotal so it
 * applies linearly to both pre-tax and tax-included unit prices.
 */
export function computeSettlementDiscountFactor(
	items: { unitPurchasePrice: number; quantity: number; appliesIva: boolean; ivaRate: number }[],
	po: { settlementDiscountType: string; settlementDiscountValue: number }
): number {
	const type = po.settlementDiscountType as PurchaseDiscountType;
	const value = Number(po.settlementDiscountValue || 0);
	if (type === PurchaseDiscountType.NONE || value <= 0) return 1;

	const subtotalPreTax = items.reduce((sum, item) => {
		const unit = Number(item.unitPurchasePrice || 0);
		const preTax = item.appliesIva && item.ivaRate ? unit / (1 + item.ivaRate / 100) : unit;
		return sum + preTax * Number(item.quantity || 0);
	}, 0);
	if (subtotalPreTax <= 0) return 1;

	const discountAmount =
		type === PurchaseDiscountType.PERCENT
			? (subtotalPreTax * Math.min(value, 100)) / 100
			: Math.min(value, subtotalPreTax);
	const factor = (subtotalPreTax - discountAmount) / subtotalPreTax;
	if (!Number.isFinite(factor)) return 1;
	return Math.max(0, Math.min(1, factor));
}
