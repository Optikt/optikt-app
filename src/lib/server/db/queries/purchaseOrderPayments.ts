import { and, desc, eq, isNull, max, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nowISO } from '$lib/dates';
import type { DbOrTx } from '$lib/server/db/types';
import {
	purchaseOrderPayments,
	type NewPurchaseOrderPayment,
	type PurchaseOrderPayment
} from '$lib/server/db/schema';

export async function getPurchaseOrderPayments(
	purchaseOrderId: string,
	{ includeVoided = false }: { includeVoided?: boolean } = {},
	executor: DbOrTx = db
): Promise<PurchaseOrderPayment[]> {
	const where = includeVoided
		? eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId)
		: and(
				eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId),
				isNull(purchaseOrderPayments.voidedAt)
			);

	return executor
		.select()
		.from(purchaseOrderPayments)
		.where(where!)
		.orderBy(desc(purchaseOrderPayments.paymentDate), desc(purchaseOrderPayments.createdAt));
}

export async function findPurchaseOrderPaymentById(
	id: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderPayment | null> {
	const [payment] = await executor
		.select()
		.from(purchaseOrderPayments)
		.where(eq(purchaseOrderPayments.id, id));
	return payment ?? null;
}

export async function getNextPurchaseOrderPaymentNumber(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<number> {
	const [row] = await executor
		.select({ maxNum: max(purchaseOrderPayments.paymentNumber) })
		.from(purchaseOrderPayments)
		.where(eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId));

	return (row?.maxNum ?? 0) + 1;
}

export async function createPurchaseOrderPayment(
	data: NewPurchaseOrderPayment,
	executor: DbOrTx = db
): Promise<PurchaseOrderPayment> {
	const now = nowISO();
	const [payment] = await executor
		.insert(purchaseOrderPayments)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return payment;
}

export async function voidPurchaseOrderPayment(
	id: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderPayment | null> {
	const [payment] = await executor
		.update(purchaseOrderPayments)
		.set({ voidedAt: nowISO(), updatedAt: nowISO() })
		.where(and(eq(purchaseOrderPayments.id, id), isNull(purchaseOrderPayments.voidedAt)))
		.returning();

	return payment ?? null;
}

export async function getPurchaseOrderPaidAmount(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<number> {
	const [row] = await executor
		.select({ total: sum(purchaseOrderPayments.amountUsdBcv) })
		.from(purchaseOrderPayments)
		.where(
			and(
				eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId),
				isNull(purchaseOrderPayments.voidedAt)
			)
		);

	return Number(row?.total ?? 0);
}
