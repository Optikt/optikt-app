import type { DbOrTx } from '#lib/server/db/types.js';
import { addSalePayment, recalcSalePaidAmount } from '#lib/server/db/queries/sales/payments.js';
import type { SalePayment } from '#lib/server/db/schema/index.js';
import type { PaymentMethod } from '#lib/shared/enums/paymentMethods.js';

export interface SalePaymentSubmission {
	saleId: string;
	paymentMethod: PaymentMethod;
	amount: number;
	exchangeRate: number | null;
	rateType: string | null;
	isCasheaPayment: boolean;
	bcvRate: number;
	paymentDate: string;
	usdBcvAmount: number;
	reference: string | null;
	notes: string | null;
}

/** Adapter over addSalePayment + recalc. Caller owns transaction via executor. */
export async function submitSalePayment(
	input: SalePaymentSubmission,
	executor: DbOrTx
): Promise<{ payment: SalePayment; paidAmount: number }> {
	const newPayment = await addSalePayment(
		{
			saleId: input.saleId,
			paymentMethod: input.paymentMethod,
			amount: input.amount,
			exchangeRate: input.exchangeRate,
			rateType: input.rateType,
			isCasheaPayment: input.isCasheaPayment,
			bcvRate: input.bcvRate,
			paymentDate: input.paymentDate,
			amountBcvUsd: input.usdBcvAmount,
			reference: input.reference,
			notes: input.notes
		},
		executor
	);
	const newPaidAmount = await recalcSalePaidAmount(input.saleId, executor);
	return { payment: newPayment, paidAmount: newPaidAmount };
}
