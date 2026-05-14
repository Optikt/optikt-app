import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, isNull, max, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nowISO } from '$lib/dates';
import type { DbOrTx } from '$lib/server/db/types';
import {
	purchaseOrderPayments,
	users,
	type NewPurchaseOrderPayment,
	type PurchaseOrderPayment
} from '$lib/server/db/schema';

export type PurchaseOrderPaymentWithUsers = PurchaseOrderPayment & {
	createdByName: string;
	voidedByName: string | null;
};

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

const createdByUser = alias(users, 'created_by_user');
const voidedByUser = alias(users, 'voided_by_user');

export async function getPurchaseOrderPaymentsWithUsers(
	purchaseOrderId: string,
	{ includeVoided = false }: { includeVoided?: boolean } = {},
	executor: DbOrTx = db
): Promise<PurchaseOrderPaymentWithUsers[]> {
	const where = includeVoided
		? eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId)
		: and(
				eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId),
				isNull(purchaseOrderPayments.voidedAt)
			);

	const rows = await executor
		.select({
			payment: purchaseOrderPayments,
			createdByName: createdByUser.fullName,
			voidedByName: voidedByUser.fullName
		})
		.from(purchaseOrderPayments)
		.innerJoin(createdByUser, eq(purchaseOrderPayments.createdById, createdByUser.id))
		.leftJoin(voidedByUser, eq(purchaseOrderPayments.voidedById, voidedByUser.id))
		.where(where!)
		.orderBy(desc(purchaseOrderPayments.paymentDate), desc(purchaseOrderPayments.createdAt));

	return rows.map((r) => ({
		...r.payment,
		createdByName: r.createdByName,
		voidedByName: r.voidedByName ?? null
	}));
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
	voidedById: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderPayment | null> {
	const [payment] = await executor
		.update(purchaseOrderPayments)
		.set({ voidedAt: nowISO(), voidedById, updatedAt: nowISO() })
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
