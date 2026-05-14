import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nowISO } from '$lib/dates';
import type { DbOrTx } from '$lib/server/db/types';
import {
	purchaseOrderCreditSchedule,
	purchaseOrders,
	suppliers,
	type NewPurchaseOrderCreditInstallment,
	type PurchaseOrderCreditInstallment
} from '$lib/server/db/schema';
import { PurchaseOrderStatus } from '$lib/shared/enums';

export interface UpcomingPurchaseOrderInstallment extends PurchaseOrderCreditInstallment {
	purchaseOrder: {
		id: string;
		orderNumber: number;
		orderDate: string;
		paymentTerms: string;
		status: string;
	};
	supplier: { id: string; name: string } | null;
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
				status: purchaseOrders.status
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

	return rows.map((row) => ({
		...row.installment,
		purchaseOrder: row.purchaseOrder,
		supplier: row.supplier?.id ? row.supplier : null
	}));
}
