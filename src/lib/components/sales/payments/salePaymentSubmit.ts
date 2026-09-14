import { toast } from 'svelte-sonner';
import { addPayment } from '$lib/remote/sales/payments.remote';
import { roundCurrency } from '../paymentFormCalculations';
import { formatPrice, getErrorMessage } from '$lib/utils';
import type { PaymentMethod } from '$lib/shared/enums';

export interface SalePaymentInput {
	saleId?: string;
	rail: PaymentMethod | null;
	paymentDate: string;
	resolvedNativeAmount: number;
	resolvedAmountUsd: number;
	needsSpecificRate: boolean;
	specificRateValue: number;
	activeBcvRate: number;
	rateType?: string;
	isCasheaSale: boolean;
	referenceToSubmit?: string;
	notes: string;
	remainingBcvUsd: number;
	pendingAfterPayment: number;
}

export interface SalePaymentCallbacks {
	setSubmitting: (value: boolean) => void;
	reset: () => void;
	partialReset: () => void;
	onPaymentAdded?: (paidAmount: number) => void;
}

export async function submitSalePayment(input: SalePaymentInput, callbacks: SalePaymentCallbacks) {
	if (!input.saleId || !input.rail) return;
	callbacks.setSubmitting(true);
	try {
		const result = await addPayment({
			saleId: input.saleId,
			paymentMethod: input.rail,
			paymentDate: input.paymentDate,
			amount: roundCurrency(input.resolvedNativeAmount),
			usdBcvAmount: input.resolvedAmountUsd,
			exchangeRate: input.needsSpecificRate ? input.specificRateValue : undefined,
			bcvRate: input.activeBcvRate,
			rateType: input.rateType ?? undefined,
			isCasheaPayment: input.isCasheaSale || undefined,
			reference: input.referenceToSubmit,
			notes: input.notes.trim() || undefined
		});

		if (!result.success) {
			toast.error(result.error ?? 'Error registrando pago');
			return;
		}

		const remainingAfterSave = Math.max(0, input.remainingBcvUsd - input.resolvedAmountUsd);
		toast.success(
			remainingAfterSave <= 0.01
				? 'Pago registrado. La venta quedó cubierta.'
				: `Pago registrado. Quedan ${formatPrice(remainingAfterSave)} pendientes.`
		);

		if (input.pendingAfterPayment <= 0.01) callbacks.reset();
		else callbacks.partialReset();
		callbacks.onPaymentAdded?.(result.paidAmount);
	} catch (error) {
		toast.error(getErrorMessage(error, 'Error registrando pago'));
	} finally {
		callbacks.setSubmitting(false);
	}
}
