import { z } from 'zod';
import { PurchasePaymentTerms } from '$lib/shared/enums';
import { CoercedNumber } from './common';

export const PurchaseOrderCreditInstallmentSchema = z.object({
	installmentNumber: z.coerce.number().int().min(1, 'Número de cuota inválido'),
	dueDate: z.iso.date('Fecha de vencimiento inválida'),
	expectedAmountUsd: CoercedNumber.positive('El monto esperado debe ser positivo').optional(),
	earlyPaymentDiscountPercent: CoercedNumber.min(0).max(100).optional(),
	earlyPaymentDiscountDeadline: z.iso.date('Fecha límite de pronto pago inválida').optional(),
	notes: z.string().trim().max(500).optional()
});

export const SetPurchaseOrderCreditScheduleSchema = z
	.object({
		purchaseOrderId: z.uuid('ID de orden de compra requerido'),
		paymentTerms: z.enum(PurchasePaymentTerms, 'Condición de pago requerida'),
		installments: z.array(PurchaseOrderCreditInstallmentSchema).default([])
	})
	.superRefine((data, ctx) => {
		if (data.paymentTerms === PurchasePaymentTerms.CONTADO) {
			if (data.installments.length > 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['installments'],
					message: 'Las órdenes de contado no deben tener cuotas'
				});
			}
			return;
		}

		if (data.installments.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['installments'],
				message: 'Debes registrar al menos una cuota para órdenes a crédito'
			});
		}

		const requiresExplicitAmounts = data.installments.length > 1;
		for (const [index, installment] of data.installments.entries()) {
			const hasDiscountPercent = (installment.earlyPaymentDiscountPercent ?? 0) > 0;
			const hasDiscountDeadline = Boolean(installment.earlyPaymentDiscountDeadline);

			if (hasDiscountPercent && !hasDiscountDeadline) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['installments', index, 'earlyPaymentDiscountDeadline'],
					message: 'La fecha límite es obligatoria cuando hay pronto pago'
				});
			}

			if (hasDiscountDeadline && !hasDiscountPercent) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['installments', index, 'earlyPaymentDiscountPercent'],
					message: 'El porcentaje es obligatorio cuando hay fecha límite de pronto pago'
				});
			}

			if (requiresExplicitAmounts && installment.expectedAmountUsd == null) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['installments', index, 'expectedAmountUsd'],
					message: 'Las cuotas múltiples deben indicar un monto esperado'
				});
			}
		}
	});
