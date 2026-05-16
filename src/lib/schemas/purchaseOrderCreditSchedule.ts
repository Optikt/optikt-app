import { z } from 'zod';
import { PurchasePaymentTerms } from '$lib/shared/enums';
import { CoercedNumber } from './common';

const PurchaseOrderCreditTermsBaseSchema = z.object({
	paymentTerms: z
		.enum(PurchasePaymentTerms, 'Condición de pago requerida')
		.default(PurchasePaymentTerms.CONTADO),
	creditDueDate: z.iso.date('Fecha de vencimiento inválida').optional().nullable(),
	earlyPaymentDiscountPercent: CoercedNumber.min(0).max(100).optional().nullable(),
	earlyPaymentDiscountDeadline: z
		.iso.date('Fecha límite de pronto pago inválida')
		.optional()
		.nullable()
});

export function validatePurchaseOrderCreditTerms(
	data: z.infer<typeof PurchaseOrderCreditTermsBaseSchema>,
	ctx: z.RefinementCtx
) {
	const hasCreditDueDate = Boolean(data.creditDueDate);
	const discountPercent = Number(data.earlyPaymentDiscountPercent ?? 0);
	const hasDiscountPercent = discountPercent > 0;
	const hasDiscountDeadline = Boolean(data.earlyPaymentDiscountDeadline);

	if (data.paymentTerms === PurchasePaymentTerms.CONTADO) {
		if (hasCreditDueDate || hasDiscountPercent || hasDiscountDeadline) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['paymentTerms'],
				message: 'Las órdenes de contado no deben tener términos de crédito'
			});
		}
		return;
	}

	if (!hasCreditDueDate) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['creditDueDate'],
			message: 'Debes indicar la fecha de vencimiento del crédito'
		});
	}

	if (hasDiscountPercent && !hasDiscountDeadline) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['earlyPaymentDiscountDeadline'],
			message: 'La fecha límite es obligatoria cuando hay pronto pago'
		});
	}

	if (hasDiscountDeadline && !hasDiscountPercent) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['earlyPaymentDiscountPercent'],
			message: 'El porcentaje es obligatorio cuando hay fecha límite de pronto pago'
		});
	}

	if (
		data.creditDueDate &&
		data.earlyPaymentDiscountDeadline &&
		data.earlyPaymentDiscountDeadline > data.creditDueDate
	) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['earlyPaymentDiscountDeadline'],
			message: 'La fecha de pronto pago no puede ser posterior al vencimiento'
		});
	}
}

export const PurchaseOrderCreditTermsSchema = PurchaseOrderCreditTermsBaseSchema.superRefine(
	validatePurchaseOrderCreditTerms
);

export const SetPurchaseOrderCreditTermsSchema = PurchaseOrderCreditTermsSchema.extend({
	purchaseOrderId: z.uuid('ID de orden de compra requerido')
});
