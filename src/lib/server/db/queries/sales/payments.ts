/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: sale payments.
 */
import { eq, isNull, and, desc, sum } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';
import { sales, salePayments, type SalePayment, type NewSalePayment } from '$lib/server/db/schema';

// SALE PAYMENTS
// ============================================================================

/**
 * Get payments for a sale
 *
 * @param includeVoided - If true, includes voided payments for history (default: false)
 */
export async function getSalePayments(
	saleId: string,
	{ includeVoided = false }: { includeVoided?: boolean } = {}
): Promise<SalePayment[]> {
	const conditions = [eq(salePayments.saleId, saleId)];
	if (!includeVoided) {
		conditions.push(isNull(salePayments.voidedAt));
	}
	return await db
		.select()
		.from(salePayments)
		.where(and(...conditions))
		.orderBy(desc(salePayments.paymentDate), desc(salePayments.createdAt));
}

/**
 * Find a payment by ID
 */
export async function findPaymentById(
	id: string,
	executor: DbOrTx = db
): Promise<SalePayment | null> {
	const [payment] = await executor
		.select()
		.from(salePayments)
		.where(and(eq(salePayments.id, id), isNull(salePayments.voidedAt)));
	return payment ?? null;
}

/**
 * Add a payment to a sale
 */
export async function addSalePayment(
	data: NewSalePayment,
	executor: DbOrTx = db
): Promise<SalePayment> {
	const now = nowISO();
	const [payment] = await executor
		.insert(salePayments)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return payment;
}

/**
 * Void a payment (soft-delete by setting voidedAt)
 */
export async function voidSalePayment(
	id: string,
	executor: DbOrTx = db
): Promise<SalePayment | null> {
	const [payment] = await executor
		.update(salePayments)
		.set({ voidedAt: nowISO(), updatedAt: nowISO() })
		.where(and(eq(salePayments.id, id), isNull(salePayments.voidedAt)))
		.returning();
	return payment ?? null;
}

/**
 * Recalculate and update the total paid amount (BCV USD) for a sale.
 * Sums all non-voided payments' amountBcvUsd.
 * Returns the new paidAmountBcvUsd value.
 */
export async function recalcSalePaidAmount(saleId: string, executor: DbOrTx = db): Promise<number> {
	const [result] = await executor
		.select({ total: sum(salePayments.amountBcvUsd) })
		.from(salePayments)
		.where(and(eq(salePayments.saleId, saleId), isNull(salePayments.voidedAt)));

	const paidAmount = Number(result?.total ?? 0);

	await executor
		.update(sales)
		.set({ paidAmountBcvUsd: paidAmount, updatedAt: nowISO() })
		.where(eq(sales.id, saleId));

	return paidAmount;
}
