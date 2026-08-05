import { z } from 'zod';
import { ALL_PURCHASE_PAYMENT_METHODS, currencyForPurchasePaymentMethod } from '$lib/shared/enums';
import { CoercedNumber } from './common';
import { requiresPurchasePaymentSpecificRate } from '$lib/shared/purchaseOrderPayments';

export const ListPurchaseOrderPaymentsSchema = z.object({
	purchaseOrderId: z.uuid('ID de orden de compra requerido'),
	includeVoided: z.boolean().default(false)
});

export const CreatePurchaseOrderPaymentSchema = z
	.object({
		purchaseOrderId: z.uuid('ID de orden de compra requerido'),
		paymentMethod: z.enum(ALL_PURCHASE_PAYMENT_METHODS, 'Método de pago requerido'),
		paymentDate: z.iso.date('La fecha del pago es requerida'),
		amount: CoercedNumber.positive('El monto debe ser positivo'),
		bcvUsdRate: CoercedNumber.positive('La tasa BCV es requerida'),
		specificRate: CoercedNumber.positive('La tasa usada debe ser positiva').optional(),
		/** Amount this payment applies against the contractual supplier debt (in the order's settlement currency). */
		amountAppliedToDebt: CoercedNumber.positive('El abono a la deuda debe ser positivo').optional(),
		rateType: z.string().trim().max(20).optional(),
		reference: z.string().trim().max(120).optional(),
		notes: z.string().trim().max(500).optional(),
		earlyPaymentBenefit: z
			.object({
				amountUsdBcv: CoercedNumber.positive('El beneficio debe ser positivo'),
				amountAppliedToDebt: CoercedNumber.positive().optional(),
				amountAppliedToDebtUsdBcvAtOrder: CoercedNumber.positive().optional(),
				appliedToBalance: z.boolean().default(true),
				note: z.string().trim().max(500).optional()
			})
			.optional()
	})
	.superRefine((data, ctx) => {
		const currencyCode = currencyForPurchasePaymentMethod(data.paymentMethod);
		if (
			requiresPurchasePaymentSpecificRate(currencyCode) &&
			(!data.specificRate || data.specificRate <= 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['specificRate'],
				message: 'La tasa usada es obligatoria para este método de pago'
			});
		}
	});

export const VoidPurchaseOrderPaymentSchema = z.object({
	id: z.uuid('ID de pago requerido'),
	purchaseOrderId: z.uuid('ID de orden de compra requerido')
});
