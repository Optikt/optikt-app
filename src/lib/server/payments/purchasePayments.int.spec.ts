import { beforeEach, describe, expect, it } from 'vitest';
import { submitPurchaseOrderPayment, voidPurchaseOrderPayment } from './purchasePayments';
import { db } from '$lib/server/db';
import { resetDb } from '$lib/testing/integration/db';
import { createPurchaseOrder, createUser } from '$lib/testing/integration/factories';
import { CurrencyCode, PaymentMethod, UserRole } from '$lib/shared/enums';
import type { PurchaseOrder } from '$lib/server/db/schema';
import type { PurchaseOrderPaymentSubmission } from './purchasePayments';

function submission(purchaseOrder: PurchaseOrder, userId: string): PurchaseOrderPaymentSubmission {
	return {
		purchaseOrder,
		paymentMethod: PaymentMethod.EFECTIVO_BS,
		currencyCode: CurrencyCode.VES,
		paymentDate: '2026-09-14T12:00:00.000Z',
		benefitDate: '2026-09-14',
		amount: 4000,
		bcvUsdRate: 40,
		specificRate: null,
		rateType: null,
		amountAppliedToDebt: 50,
		amountBs: 4000,
		amountUsdBcv: 100,
		reference: null,
		notes: null,
		earlyPaymentBenefit: null,
		userId
	};
}

describe('purchasePayments adapter', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('records a payment and amortizes native debt to USD BCV at order', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const purchaseOrder = await createPurchaseOrder({
			settlementDebtAmount: 200,
			settlementDebtAmountUsdBcvAtOrder: 100
		});

		const result = await db.transaction((tx) =>
			submitPurchaseOrderPayment(submission(purchaseOrder, admin.id), tx)
		);

		expect(result.payment.amountAppliedToDebt).toBe(50);
		expect(result.payment.amountAppliedToDebtUsdBcvAtOrder).toBe(25);
		expect(result.payment.createdById).toBe(admin.id);
	});

	it('voids a payment and returns the recomputed balance', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const purchaseOrder = await createPurchaseOrder();

		const created = await db.transaction((tx) =>
			submitPurchaseOrderPayment(submission(purchaseOrder, admin.id), tx)
		);

		const result = await db.transaction((tx) =>
			voidPurchaseOrderPayment(
				{ purchaseOrder, paymentId: created.payment.id, userId: admin.id },
				tx
			)
		);

		expect(result.voided.voidedAt).not.toBeNull();
		expect(result.balance).toBeDefined();
	});
});
