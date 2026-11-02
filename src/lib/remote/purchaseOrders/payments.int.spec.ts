import { beforeEach, describe, expect, it } from 'vitest';
import {
	addPurchaseOrderPaymentCmd,
	registerPurchaseOrderEarlyPaymentBenefitCmd,
	voidPurchaseOrderPaymentCmd
} from './payments.remote';
import { resetDb } from '$lib/testing/integration/db';
import { createPurchaseOrder, createUser } from '$lib/testing/integration/factories';
import { callRemote } from '$lib/testing/remoteHarness';
import {
	PaymentMethod,
	PurchaseOrderStatus,
	PurchasePaymentTerms,
	UserRole
} from '$lib/shared/enums';

type AddPaymentInput = Parameters<typeof addPurchaseOrderPaymentCmd>[0];

function payment(purchaseOrderId: string): AddPaymentInput {
	return {
		purchaseOrderId,
		paymentMethod: PaymentMethod.EFECTIVO_BS,
		paymentDate: '2026-09-14',
		amount: 4000,
		bcvUsdRate: 40
	};
}

type RegisterBenefitInput = Parameters<typeof registerPurchaseOrderEarlyPaymentBenefitCmd>[0];

function benefit(purchaseOrderId: string): RegisterBenefitInput {
	return {
		purchaseOrderId,
		amount: 10,
		benefitDate: '2026-10-09',
		appliedToBalance: true
	};
}

type VoidPaymentInput = Parameters<typeof voidPurchaseOrderPaymentCmd>[0];

function voidPayment(id: string, purchaseOrderId: string): VoidPaymentInput {
	return { id, purchaseOrderId };
}

async function creditOrderWithProntoPago() {
	const admin = await createUser({ role: UserRole.ADMIN });
	const purchaseOrder = await createPurchaseOrder({
		status: PurchaseOrderStatus.CONFIRMED,
		paymentTerms: PurchasePaymentTerms.CREDIT,
		creditDueDate: '2026-11-11',
		earlyPaymentDiscountPercent: 5,
		earlyPaymentDiscountDeadline: '2026-10-11',
		settlementDebtAmount: 345,
		settlementDebtAmountUsdBcvAtOrder: 345
	});
	return { admin, purchaseOrder };
}

describe('addPurchaseOrderPaymentCmd (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('rejects an unauthenticated caller with 401', async () => {
		const { purchaseOrder } = await creditOrderWithProntoPago();

		await expect(
			callRemote(addPurchaseOrderPaymentCmd, payment(purchaseOrder.id), { user: null })
		).rejects.toMatchObject({ status: 401 });
	});

	it('rejects invalid input with 400 through the real validation hook', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		await expect(
			callRemote(
				addPurchaseOrderPaymentCmd,
				{ ...payment(purchaseOrder.id), amount: 0 },
				{ user: admin }
			)
		).rejects.toMatchObject({ status: 400 });
	});

	it('records a payment through the real command wrapper', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const result = await callRemote<AddPaymentInput, { success: boolean }>(
			addPurchaseOrderPaymentCmd,
			payment(purchaseOrder.id),
			{ user: admin }
		);

		expect(result.success).toBe(true);
	});

	it('records a payment bundled with its pronto pago benefit inside the window', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const result = await callRemote<
			AddPaymentInput,
			{ success: boolean; benefit?: unknown; balance?: { settlementBenefitsApplied: number } }
		>(
			addPurchaseOrderPaymentCmd,
			{
				...payment(purchaseOrder.id),
				earlyPaymentBenefit: { amountUsdBcv: 17.25, appliedToBalance: true }
			},
			{ user: admin }
		);

		expect(result.success).toBe(true);
		expect(result.balance?.settlementBenefitsApplied).toBe(17.25);
	});

	it('rejects a payment benefit dated after the deadline', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const result = await callRemote<AddPaymentInput, { success: false; error: string }>(
			addPurchaseOrderPaymentCmd,
			{
				...payment(purchaseOrder.id),
				paymentDate: '2026-10-15',
				earlyPaymentBenefit: { amountUsdBcv: 17.25, appliedToBalance: true }
			},
			{ user: admin }
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain('dentro del plazo');
	});

	it('rejects a payment benefit above the residual % cap', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		await callRemote(
			addPurchaseOrderPaymentCmd,
			{
				...payment(purchaseOrder.id),
				earlyPaymentBenefit: { amountUsdBcv: 10, appliedToBalance: true }
			},
			{ user: admin }
		);

		const result = await callRemote<AddPaymentInput, { success: false; error: string }>(
			addPurchaseOrderPaymentCmd,
			{
				...payment(purchaseOrder.id),
				earlyPaymentBenefit: { amountUsdBcv: 8, appliedToBalance: true }
			},
			{ user: admin }
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain('no puede superar 7.25');
	});
});

describe('registerPurchaseOrderEarlyPaymentBenefitCmd (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('registers a retroactive benefit and closes part of the balance', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const result = await callRemote<
			RegisterBenefitInput,
			{ success: boolean; balance?: { settlementBalance: number } }
		>(registerPurchaseOrderEarlyPaymentBenefitCmd, benefit(purchaseOrder.id), { user: admin });

		expect(result.success).toBe(true);
		expect(result.balance?.settlementBalance).toBe(335);
	});

	it('rejects a benefit on an order without pronto pago terms', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const purchaseOrder = await createPurchaseOrder();

		const result = await callRemote<RegisterBenefitInput, { success: false; error: string }>(
			registerPurchaseOrderEarlyPaymentBenefitCmd,
			benefit(purchaseOrder.id),
			{ user: admin }
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain('no tiene un descuento');
	});

	it('rejects a benefit above the cap at the command boundary', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const result = await callRemote<RegisterBenefitInput, { success: false; error: string }>(
			registerPurchaseOrderEarlyPaymentBenefitCmd,
			{ ...benefit(purchaseOrder.id), amount: 20 },
			{ user: admin }
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain('no puede superar');
	});
});

describe('voidPurchaseOrderPaymentCmd (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('voids a payment through the real command wrapper', async () => {
		const { admin, purchaseOrder } = await creditOrderWithProntoPago();

		const added = await callRemote<
			AddPaymentInput,
			{ success: boolean; payments?: { id: string }[] }
		>(addPurchaseOrderPaymentCmd, payment(purchaseOrder.id), { user: admin });
		const paymentId = added.payments?.[0]?.id;
		expect(paymentId).toBeDefined();

		const result = await callRemote<
			VoidPaymentInput,
			{ success: boolean; voided?: { voidedAt: string | null } }
		>(voidPurchaseOrderPaymentCmd, voidPayment(paymentId!, purchaseOrder.id), { user: admin });

		expect(result.success).toBe(true);
		expect(result.voided?.voidedAt).not.toBeNull();
	});
});
