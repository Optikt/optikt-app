import { nowUTC, toISODate } from '$lib/dates';
import { CurrencyCode, PaymentMethod, currencyForPurchasePaymentMethod } from '$lib/shared/enums';
import { getDefaultPaymentCalculationMode } from '../paymentFormCalculations';
import type { PaymentComposerRequest, PaymentFormKind } from './paymentFormDerived';

export class PaymentFormSelection {
	currencyKey = $state<string | null>(null);
	rail = $state<PaymentMethod | null>(null);
	lastEditedAmount = $state<'native' | 'usd'>('native');
	nativeAmountInput = $state('');
	usdBcvAmountInput = $state('');
	bcvRateInput = $state('');
	specificRateInput = $state('');
	paymentDate = $state(toISODate(nowUTC()));
	reference = $state('');
	notes = $state('');

	reset() {
		this.currencyKey = null;
		this.rail = null;
		this.lastEditedAmount = 'native';
		this.nativeAmountInput = '';
		this.usdBcvAmountInput = '';
		this.bcvRateInput = '';
		this.specificRateInput = '';
		this.paymentDate = toISODate(nowUTC());
		this.reference = '';
		this.notes = '';
	}

	partialReset() {
		this.nativeAmountInput = '';
		this.usdBcvAmountInput = '';
		this.bcvRateInput = '';
		this.specificRateInput = '';
		this.reference = '';
		this.notes = '';
	}

	resetFromRequest(request: PaymentComposerRequest | null = null) {
		this.rail = request?.paymentMethod ?? null;
		const rail = this.rail;
		this.currencyKey = rail
			? currencyForPurchasePaymentMethod(rail) === CurrencyCode.EUR_BCV
				? 'EUR_BCV'
				: currencyForPurchasePaymentMethod(rail) === CurrencyCode.USDT
					? 'USDT'
					: currencyForPurchasePaymentMethod(rail) === CurrencyCode.USD_PAYPAL
						? 'PAYPAL'
						: 'VES'
			: null;
		this.paymentDate = request?.paymentDate ?? toISODate(nowUTC());
		this.nativeAmountInput = request?.amount != null ? request.amount.toFixed(2) : '';
		this.usdBcvAmountInput = '';
		this.lastEditedAmount = 'native';
		this.bcvRateInput = '';
		this.specificRateInput = '';
		this.reference = request?.reference ?? '';
		this.notes = request?.notes ?? '';
	}

	selectCurrency(key: string) {
		if (this.currencyKey === key) return;
		this.currencyKey = key;
		this.rail = null;
		this.lastEditedAmount = 'native';
		this.nativeAmountInput = '';
		this.usdBcvAmountInput = '';
		this.specificRateInput = '';
	}

	selectRail(method: PaymentMethod, autoSpecificRate: number) {
		this.rail = method;
		this.lastEditedAmount =
			getDefaultPaymentCalculationMode(method) === 'target' ? 'usd' : 'native';
		this.nativeAmountInput = '';
		this.usdBcvAmountInput = '';
		this.bcvRateInput = '';
		this.specificRateInput = autoSpecificRate > 0 ? autoSpecificRate.toFixed(2) : '';
		this.reference = '';
		this.notes = '';
	}

	handleNativeInput(event: Event) {
		this.lastEditedAmount = 'native';
		this.nativeAmountInput = (event.currentTarget as HTMLInputElement).value;
	}

	handleUsdInput(event: Event) {
		this.lastEditedAmount = 'usd';
		this.usdBcvAmountInput = (event.currentTarget as HTMLInputElement).value;
	}

	useRemainingBalance(
		kind: PaymentFormKind,
		debtBalanceUsd: number,
		formatInputValue: (value: number) => string
	) {
		if (kind !== 'sale' || !this.rail) return;
		this.lastEditedAmount = 'usd';
		this.usdBcvAmountInput = formatInputValue(debtBalanceUsd);
	}
}
