import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nowISO } from '$lib/dates';
import type { DbOrTx } from '$lib/server/db/types';
import {
	purchaseOrderCreditSchedule,
	purchaseOrderItems,
	purchaseOrderPayments,
	purchaseOrders,
	suppliers,
	type NewPurchaseOrderCreditInstallment,
	type PurchaseOrderCreditInstallment
} from '$lib/server/db/schema';
import { PurchaseOrderStatus } from '$lib/shared/enums';
import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus,
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

export interface UpcomingPurchaseOrderInstallment extends PurchaseOrderCreditInstallment {
	purchaseOrder: {
		id: string;
		orderNumber: number;
		orderDate: string;
		paymentTerms: string;
		status: string;
		settlementDiscountType: string;
		settlementDiscountValue: number;
	};
	supplier: { id: string; name: string } | null;
	balance: PurchaseOrderBalanceSummary;
	dueStatus: PurchaseOrderDueStatus;
}

export async function getPurchaseOrderCreditSchedule(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderCreditInstallment[]> {
	return executor
		.select()
		.from(purchaseOrderCreditSchedule)
		.where(eq(purchaseOrderCreditSchedule.purchaseOrderId, purchaseOrderId))
		.orderBy(
			asc(purchaseOrderCreditSchedule.installmentNumber),
			asc(purchaseOrderCreditSchedule.dueDate)
		);
}

export async function replacePurchaseOrderCreditSchedule(
	purchaseOrderId: string,
	installments: Array<
		Omit<NewPurchaseOrderCreditInstallment, 'purchaseOrderId' | 'id' | 'createdAt' | 'updatedAt'>
	>,
	executor: DbOrTx = db
): Promise<PurchaseOrderCreditInstallment[]> {
	await executor
		.delete(purchaseOrderCreditSchedule)
		.where(eq(purchaseOrderCreditSchedule.purchaseOrderId, purchaseOrderId));

	if (installments.length === 0) {
		return [];
	}

	const now = nowISO();
	return executor
		.insert(purchaseOrderCreditSchedule)
		.values(
			installments.map((installment) => ({
				...installment,
				id: crypto.randomUUID(),
				purchaseOrderId,
				createdAt: now,
				updatedAt: now
			}))
		)
		.returning();
}

export async function getUpcomingPurchaseOrderDueInstallments(
	dateFrom: string,
	dateTo: string,
	executor: DbOrTx = db
): Promise<UpcomingPurchaseOrderInstallment[]> {
	const rows = await executor
		.select({
			installment: purchaseOrderCreditSchedule,
			purchaseOrder: {
				id: purchaseOrders.id,
				orderNumber: purchaseOrders.orderNumber,
				orderDate: purchaseOrders.orderDate,
				paymentTerms: purchaseOrders.paymentTerms,
				status: purchaseOrders.status,
				settlementDiscountType: purchaseOrders.settlementDiscountType,
				settlementDiscountValue: purchaseOrders.settlementDiscountValue
			},
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(purchaseOrderCreditSchedule)
		.innerJoin(purchaseOrders, eq(purchaseOrderCreditSchedule.purchaseOrderId, purchaseOrders.id))
		.leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
		.where(
			and(
				gte(purchaseOrderCreditSchedule.dueDate, dateFrom),
				lte(purchaseOrderCreditSchedule.dueDate, dateTo),
				eq(purchaseOrders.status, PurchaseOrderStatus.CONFIRMED),
				isNull(purchaseOrders.deletedAt)
			)
		)
		.orderBy(
			asc(purchaseOrderCreditSchedule.dueDate),
			asc(purchaseOrderCreditSchedule.installmentNumber)
		);

	if (rows.length === 0) return [];

	const purchaseOrderIds = [...new Set(rows.map((row) => row.purchaseOrder.id))];
	const [items, payments, schedules] = await Promise.all([
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
			.from(purchaseOrderCreditSchedule)
			.where(inArray(purchaseOrderCreditSchedule.purchaseOrderId, purchaseOrderIds))
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

	const schedulesByOrderId = new Map<string, typeof schedules>();
	for (const schedule of schedules) {
		schedulesByOrderId.set(schedule.purchaseOrderId, [
			...(schedulesByOrderId.get(schedule.purchaseOrderId) ?? []),
			schedule
		]);
	}

	return rows
		.map((row) => {
			const orderItems = itemsByOrderId.get(row.purchaseOrder.id) ?? [];
			const orderPayments = paymentsByOrderId.get(row.purchaseOrder.id) ?? [];
			const orderSchedule = schedulesByOrderId.get(row.purchaseOrder.id) ?? [];
			const balance = computePurchaseOrderBalance(
				row.purchaseOrder,
				orderItems,
				orderPayments,
				orderSchedule
			);
			const dueStatus = getPurchaseOrderDueStatus({
				paymentTerms: row.purchaseOrder.paymentTerms,
				installments: orderSchedule,
				balance: balance.balance
			});

			return {
				...row.installment,
				purchaseOrder: row.purchaseOrder,
				supplier: row.supplier?.id ? row.supplier : null,
				balance,
				dueStatus
			};
		})
		.filter((installment) => installment.balance.balance > 0.01);
}
