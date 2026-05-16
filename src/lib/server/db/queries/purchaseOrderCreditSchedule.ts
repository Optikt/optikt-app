import { and, asc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	purchaseOrderEarlyPaymentBenefits,
	purchaseOrderItems,
	purchaseOrderPayments,
	purchaseOrders,
	suppliers
} from '$lib/server/db/schema';
import { PurchaseOrderStatus, PurchasePaymentTerms } from '$lib/shared/enums';
import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus,
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

export interface UpcomingPurchaseOrderDue {
	id: string;
	dueDate: string;
	expectedAmountUsd: number | null;
	purchaseOrder: {
		id: string;
		orderNumber: number;
		orderDate: string;
		paymentTerms: string;
		status: string;
		settlementDiscountType: string;
		settlementDiscountValue: number;
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
	};
	supplier: { id: string; name: string } | null;
	balance: PurchaseOrderBalanceSummary;
	dueStatus: PurchaseOrderDueStatus;
}

export async function getUpcomingPurchaseOrderDues(
	dateFrom: string,
	dateTo: string,
	executor: DbOrTx = db
): Promise<UpcomingPurchaseOrderDue[]> {
	const rows = await executor
		.select({
			purchaseOrder: {
				id: purchaseOrders.id,
				orderNumber: purchaseOrders.orderNumber,
				orderDate: purchaseOrders.orderDate,
				paymentTerms: purchaseOrders.paymentTerms,
				status: purchaseOrders.status,
				settlementDiscountType: purchaseOrders.settlementDiscountType,
				settlementDiscountValue: purchaseOrders.settlementDiscountValue,
				creditDueDate: purchaseOrders.creditDueDate,
				earlyPaymentDiscountPercent: purchaseOrders.earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline: purchaseOrders.earlyPaymentDiscountDeadline
			},
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(purchaseOrders)
		.leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
		.where(
			and(
				eq(purchaseOrders.paymentTerms, PurchasePaymentTerms.CREDIT),
				isNotNull(purchaseOrders.creditDueDate),
				gte(purchaseOrders.creditDueDate, dateFrom),
				lte(purchaseOrders.creditDueDate, dateTo),
				eq(purchaseOrders.status, PurchaseOrderStatus.CONFIRMED),
				isNull(purchaseOrders.deletedAt)
			)
		)
		.orderBy(asc(purchaseOrders.creditDueDate), asc(purchaseOrders.orderNumber));

	if (rows.length === 0) return [];

	const purchaseOrderIds = [...new Set(rows.map((row) => row.purchaseOrder.id))];
	const [items, payments, benefits] = await Promise.all([
		executor
			.select()
			.from(purchaseOrderItems)
			.where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds)),
		executor
			.select()
			.from(purchaseOrderPayments)
			.where(inArray(purchaseOrderPayments.purchaseOrderId, purchaseOrderIds)),
		executor
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

	return rows
		.map((row) => {
			const orderItems = itemsByOrderId.get(row.purchaseOrder.id) ?? [];
			const orderPayments = paymentsByOrderId.get(row.purchaseOrder.id) ?? [];
			const orderBenefits = benefitsByOrderId.get(row.purchaseOrder.id) ?? [];
			const balance = computePurchaseOrderBalance(
				row.purchaseOrder,
				orderItems,
				orderPayments,
				orderBenefits
			);
			const dueStatus = getPurchaseOrderDueStatus({
				paymentTerms: row.purchaseOrder.paymentTerms,
				creditDueDate: row.purchaseOrder.creditDueDate,
				earlyPaymentDiscountDeadline: row.purchaseOrder.earlyPaymentDiscountDeadline,
				balance: balance.balance
			});

			return {
				id: row.purchaseOrder.id,
				dueDate: row.purchaseOrder.creditDueDate ?? '',
				expectedAmountUsd: balance.balance,
				purchaseOrder: row.purchaseOrder,
				supplier: row.supplier?.id ? row.supplier : null,
				balance,
				dueStatus
			};
		})
		.filter((due) => due.balance.balance > 0.01);
}
