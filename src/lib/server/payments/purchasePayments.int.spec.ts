import { beforeEach, describe, expect, it } from 'vitest';
import {
	registerPurchaseOrderEarlyPaymentBenefit,
	submitPurchaseOrderPayment,
	voidPurchaseOrderPayment
} from './purchasePayments';
import { db } from '$lib/server/db';
import { resetDb } from '$lib/testing/integration/db';
import { createPurchaseOrder, createUser } from '$lib/testing/integration/factories';
import { CurrencyCode, PaymentMethod, PurchasePaymentTerms, UserRole } from '$lib/shared/enums';
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

describe('registerPurchaseOrderEarlyPaymentBenefit', () => {
	beforeEach(async () => {
		await resetDb();
	});

	async function creditOrderWithProntoPago() {
		const admin = await createUser({ role: UserRole.ADMIN });
		const purchaseOrder = await createPurchaseOrder({
			paymentTerms: PurchasePaymentTerms.CREDIT,
			creditDueDate: '2026-11-11',
			earlyPaymentDiscountPercent: 5,
			earlyPaymentDiscountDeadline: '2026-10-11',
			settlementGrossAmount: 345,
			settlementDebtAmount: 345,
			settlementDebtAmountUsdBcvAtOrder: 345
		});
		return { admin, purchaseOrder };
	}

	it('registers a retroactive benefit inside the window and closes the balance', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const result = await db.transaction((tx) =>
			registerPurchaseOrderEarlyPaymentBenefit(
				{
					purchaseOrder,
					amount: 17.25,
					benefitDate: '2026-10-09',
					appliedToBalance: true,
					note: 'Pago realizado el 09/10, registrado tarde',
					userId: admin.id
				},
				tx
			)
		);

		expect(result.benefit.paymentId).toBeNull();
		expect(result.benefit.amountAppliedToDebt).toBe(17.25);
		expect(result.benefit.amountUsdBcv).toBe(17.25);
		expect(result.balance.settlementBenefitsApplied).toBe(17.25);
		expect(result.balance.settlementBalance).toBe(327.75);
	});

	it('rejects a benefit dated after the pronto pago deadline', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		await expect(
			db.transaction((tx) =>
				registerPurchaseOrderEarlyPaymentBenefit(
					{
						purchaseOrder,
						amount: 17.25,
						benefitDate: '2026-10-15',
						appliedToBalance: true,
						userId: admin.id
					},
					tx
				)
			)
		).rejects.toThrow('dentro del plazo');
	});

	it('rejects a benefit above the 5% cap', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		await expect(
			db.transaction((tx) =>
				registerPurchaseOrderEarlyPaymentBenefit(
					{
						purchaseOrder,
						amount: 20,
						benefitDate: '2026-10-09',
						appliedToBalance: true,
						userId: admin.id
					},
					tx
				)
			)
		).rejects.toThrow('no puede superar');
	});

	it('rejects pronto pago on orders without terms configured', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const purchaseOrder = await createPurchaseOrder();

		await expect(
			db.transaction((tx) =>
				registerPurchaseOrderEarlyPaymentBenefit(
					{
						purchaseOrder,
						amount: 5,
						benefitDate: '2026-10-09',
						appliedToBalance: true,
						userId: admin.id
					},
					tx
				)
			)
		).rejects.toThrow('no tiene pronto pago');
	});
});
