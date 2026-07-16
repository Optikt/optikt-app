import { z } from 'zod';
import { ALL_PURCHASE_PAYMENT_CURRENCY_CODES, CurrencyCode } from '$lib/shared/enums';
import { CoercedNumber } from './common';
import { requiresPurchasePaymentSpecificRate } from '$lib/shared/purchaseOrderPayments';

export const ListPurchaseOrderPaymentsSchema = z.object({
	purchaseOrderId: z.uuid('ID de orden de compra requerido'),
	includeVoided: z.boolean().default(false)
});

export const CreatePurchaseOrderPaymentSchema = z
	.object({
		purchaseOrderId: z.uuid('ID de orden de compra requerido'),
		currencyCode: z.enum(ALL_PURCHASE_PAYMENT_CURRENCY_CODES, 'Moneda requerida'),
		paymentDate: z.iso.date('La fecha del pago es requerida'),
		amount: CoercedNumber.positive('El monto debe ser positivo'),
		bcvUsdRate: CoercedNumber.positive('La tasa BCV es requerida'),
		specificRate: CoercedNumber.positive('La tasa usada debe ser positiva').optional(),
		/** Amount this payment applies against the contractual supplier debt (in the order's settlement currency). */
		amountAppliedToDebt: CoercedNumber.positive('El abono a la deuda debe ser positivo').optional(),
		reference: z.string().trim().max(120).optional(),
		notes: z.string().trim().max(500).optional(),
		earlyPaymentBenefit: z
			.object({
				amountUsdBcv: CoercedNumber.positive('El beneficio debe ser positivo'),
				appliedToBalance: z.boolean().default(true),
				note: z.string().trim().max(500).optional()
			})
			.optional()
	})
	.superRefine((data, ctx) => {
		if (
			requiresPurchasePaymentSpecificRate(data.currencyCode as CurrencyCode) &&
			(!data.specificRate || data.specificRate <= 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['specificRate'],
				message: 'La tasa usada es obligatoria para esta moneda'
			});
		}
	});

export const VoidPurchaseOrderPaymentSchema = z.object({
	id: z.uuid('ID de pago requerido'),
	purchaseOrderId: z.uuid('ID de orden de compra requerido')
});
