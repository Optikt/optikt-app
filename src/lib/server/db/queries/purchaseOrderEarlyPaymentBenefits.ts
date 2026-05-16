import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nowISO } from '$lib/dates';
import type { DbOrTx } from '$lib/server/db/types';
import {
	purchaseOrderEarlyPaymentBenefits,
	type NewPurchaseOrderEarlyPaymentBenefit,
	type PurchaseOrderEarlyPaymentBenefit
} from '$lib/server/db/schema';

export async function getPurchaseOrderEarlyPaymentBenefits(
	purchaseOrderId: string,
	{ includeVoided = false }: { includeVoided?: boolean } = {},
	executor: DbOrTx = db
): Promise<PurchaseOrderEarlyPaymentBenefit[]> {
	const where = includeVoided
		? eq(purchaseOrderEarlyPaymentBenefits.purchaseOrderId, purchaseOrderId)
		: and(
				eq(purchaseOrderEarlyPaymentBenefits.purchaseOrderId, purchaseOrderId),
				isNull(purchaseOrderEarlyPaymentBenefits.voidedAt)
			);

	return executor
		.select()
		.from(purchaseOrderEarlyPaymentBenefits)
		.where(where!)
		.orderBy(
			desc(purchaseOrderEarlyPaymentBenefits.benefitDate),
			desc(purchaseOrderEarlyPaymentBenefits.createdAt)
		);
}

export async function getPurchaseOrderEarlyPaymentBenefitsForOrders(
	purchaseOrderIds: string[],
	{ includeVoided = false }: { includeVoided?: boolean } = {},
	executor: DbOrTx = db
): Promise<PurchaseOrderEarlyPaymentBenefit[]> {
	if (purchaseOrderIds.length === 0) return [];

	const where = includeVoided
		? inArray(purchaseOrderEarlyPaymentBenefits.purchaseOrderId, purchaseOrderIds)
		: and(
				inArray(purchaseOrderEarlyPaymentBenefits.purchaseOrderId, purchaseOrderIds),
				isNull(purchaseOrderEarlyPaymentBenefits.voidedAt)
			);

	return executor.select().from(purchaseOrderEarlyPaymentBenefits).where(where!);
}

export async function createPurchaseOrderEarlyPaymentBenefit(
	data: Omit<NewPurchaseOrderEarlyPaymentBenefit, 'id' | 'createdAt' | 'updatedAt'>,
	executor: DbOrTx = db
): Promise<PurchaseOrderEarlyPaymentBenefit> {
	const now = nowISO();
	const [benefit] = await executor
		.insert(purchaseOrderEarlyPaymentBenefits)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return benefit;
}

export async function voidPurchaseOrderEarlyPaymentBenefitsByPayment(
	paymentId: string,
	voidedById: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderEarlyPaymentBenefit[]> {
	const now = nowISO();
	return executor
		.update(purchaseOrderEarlyPaymentBenefits)
		.set({ voidedAt: now, voidedById, updatedAt: now })
		.where(
			and(
				eq(purchaseOrderEarlyPaymentBenefits.paymentId, paymentId),
				isNull(purchaseOrderEarlyPaymentBenefits.voidedAt)
			)
		)
		.returning();
}
