import { untrack } from 'svelte';
import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
import { formatPrice } from '$lib/utils';
import { PaymentMethod } from '$lib/shared/enums';
import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
import { PaymentFormSelection } from './paymentFormSelection.svelte';
import { PurchaseFlowState } from './purchaseFlowState.svelte';
import { computePaymentFormValues, type PaymentFormValues } from './paymentFormValues';
import {
	createPurchaseSubmitApi,
	submitPurchasePayment,
	computeDeliveryAmountForAppliedDebt,
	type PurchaseSubmitSnapshot
} from './purchasePayment';
import { submitSalePayment } from './salePaymentSubmit';
import type { PaymentComposerRequest, PaymentFormProps } from './paymentFormDerived';

function formatInputValue(value: number): string {
	return value > 0 ? value.toFixed(2) : '';
}

/**
 * Headless model for PaymentForm: owns the selection state, the derived money
 * math (pure `computePaymentFormValues`), the purchase sub-machine and the
 * submit handlers. The component only wires props and markup.
 */
export class PaymentFormModel {
	readonly sel = new PaymentFormSelection();
	readonly purchase = new PurchaseFlowState();
	submitting = $state(false);

	readonly #props: () => PaymentFormProps;
	readonly #store = getExchangeRatesStore();
	readonly #purchaseApi: ReturnType<typeof createPurchaseSubmitApi>;

	#prevDrawerResetKey = 0;
	#lastComposerToken = '';

	constructor(getProps: () => PaymentFormProps) {
		this.#props = getProps;
		this.#purchaseApi = createPurchaseSubmitApi(
			() => this.purchaseSnapshot(),
			this.purchaseCallbacks()
		);
	}

	values: PaymentFormValues = $derived.by(() =>
		computePaymentFormValues({
			props: this.#props(),
			selection: {
				currencyKey: this.sel.currencyKey,
				rail: this.sel.rail,
				lastEditedAmount: this.sel.lastEditedAmount,
				nativeAmountInput: this.sel.nativeAmountInput,
				usdBcvAmountInput: this.sel.usdBcvAmountInput,
				bcvRateInput: this.sel.bcvRateInput,
				specificRateInput: this.sel.specificRateInput,
				paymentDate: this.sel.paymentDate,
				reference: this.sel.reference
			},
			storeBcvRate: this.#store.bcvRate,
			eurRate: this.#store.rates.find((r) => r.code === 'EUR')?.value ?? 0,
			usdtRate: this.#store.rates.find((r) => r.sourceKey === 'usdt')?.value ?? 0,
			paypalRate: this.#store.rates.find((r) => r.code === 'PAYPAL')?.value ?? 0
		})
	);

	canSubmit = $derived.by(
		() =>
			!!this.sel.rail &&
			!!this.sel.currencyKey &&
			this.values.hasValidAmounts &&
			this.values.hasValidRate &&
			!!this.sel.paymentDate &&
			this.values.hasRequiredReference &&
			!this.submitting
	);

	drawerSubmitLabel = $derived.by(() =>
		this.#props().kind === 'sale' && this.values.pendingAfterPayment <= 0.01
			? 'Finalizar Venta'
			: 'Aplicar Pago'
	);

	submitLabel = $derived.by(() =>
		this.values.hasValidAmounts
			? `Registrar abono de ${formatPrice(this.values.resolvedAmountUsd)}`
			: 'Registrar pago'
	);

	// ----- Reset -----
	reset = () => {
		this.sel.reset();
	};

	partialReset = () => {
		this.sel.partialReset();
	};

	resetForm = (request: PaymentComposerRequest | null = null) => {
		this.sel.resetFromRequest(request);
	};

	// ----- Effects (called from the component's $effect) -----
	syncDrawerReset = (key: number) => {
		if (key !== this.#prevDrawerResetKey) {
			this.#prevDrawerResetKey = key;
			this.reset();
		}
	};

	applyComposerRequest = () => {
		const props = this.#props();
		if (
			props.kind !== 'purchase' ||
			!props.composerRequest ||
			!this.values.canManagePurchasePayments
		)
			return;
		if (props.composerRequest.token === this.#lastComposerToken) return;
		untrack(() => {
			this.#lastComposerToken = props.composerRequest!.token;
			this.resetForm(props.composerRequest);
		});
	};

	preselectNativeSettlement = () => {
		const props = this.#props();
		if (props.kind !== 'purchase' || !this.values.isNativeSettlement || this.sel.currencyKey)
			return;
		const map: Record<string, { key: string; rail: PaymentMethod; rate: number }> = {
			EUR_BCV: {
				key: 'EUR_BCV',
				rail: PaymentMethod.EFECTIVO_EUR,
				rate: this.#store.rates.find((r) => r.code === 'EUR')?.value ?? 0
			},
			USDT: {
				key: 'USDT',
				rail: PaymentMethod.BINANCE_USDT,
				rate: this.#store.rates.find((r) => r.sourceKey === 'usdt')?.value ?? 0
			},
			USD_PAYPAL: {
				key: 'PAYPAL',
				rail: PaymentMethod.PAYPAL,
				rate: this.#store.rates.find((r) => r.code === 'PAYPAL')?.value ?? 0
			}
		};
		const preset = map[props.settlementCurrency!];
		if (!preset) return;
		this.sel.currencyKey = preset.key;
		this.sel.rail = preset.rail;
		this.sel.lastEditedAmount = 'native';
		const orderRate = props.purchaseOrder?.sourceRateToVes;
		const rate = preset.rate > 0 ? preset.rate : (orderRate ?? 0);
		if (rate > 0) this.sel.specificRateInput = rate.toFixed(2);
	};

	// ----- Selection handlers -----
	selectCurrency = (key: string) => {
		this.sel.selectCurrency(key);
	};

	selectRail = (method: PaymentMethod) => {
		this.sel.selectRail(method, this.values.autoSpecificRate);
	};

	handleNativeInput = (event: Event) => {
		this.sel.handleNativeInput(event);
	};

	handleUsdInput = (event: Event) => {
		this.sel.handleUsdInput(event);
	};

	useRemainingBalance = () => {
		this.sel.useRemainingBalance(this.#props().kind, this.values.debtBalanceUsd, formatInputValue);
	};

	/** Pre-fills the amount with the net payment after the pronto pago discount. */
	applyProntoPago = () => {
		const info = this.values.prontoPagoInfo;
		if (!info || info.recommendedPayment <= 0) return;
		if (this.values.isNativeSettlement) {
			if (!this.sel.rail) return;
			// recommendedPayment is in settlement units; the amount field is in
			// the rail's delivery currency, so convert via the amortization math.
			this.sel.lastEditedAmount = 'native';
			this.sel.nativeAmountInput = formatInputValue(
				computeDeliveryAmountForAppliedDebt({
					railCurrency: this.values.purchaseCurrencyCode,
					appliedDebt: info.recommendedPayment,
					settlementRateToVes: this.values.settlementRateToVes,
					bcvRate: this.values.activeBcvRate,
					specificRateValue: this.values.specificRateValue
				})
			);
		} else {
			this.sel.lastEditedAmount = 'usd';
			this.sel.usdBcvAmountInput = formatInputValue(info.recommendedPayment);
		}
	};

	// ----- Purchase flow -----
	resetEarlyPaymentState = () => {
		this.purchase.reset();
	};

	purchaseCallbacks = () => ({
		setSubmitting: (value: boolean) => (this.submitting = value),
		onFinanceChanged: (payload: Parameters<NonNullable<PaymentFormProps['onFinanceChanged']>>[0]) =>
			this.#props().onFinanceChanged?.(payload),
		partialReset: this.partialReset,
		setPendingAddPayload: (payload: Parameters<typeof submitPurchasePayment>[0] | null) =>
			(this.purchase.pendingAddPayload = payload),
		setShowOverpaymentModal: (value: boolean) => (this.purchase.showOverpaymentModal = value),
		setPendingBenefitSuggestion: (suggestion: EarlyPaymentDiscountSuggestion | null) =>
			(this.purchase.pendingBenefitSuggestion = suggestion),
		setBenefitAmountInput: (value: string) => (this.purchase.benefitAmountInput = value),
		setBenefitNoteInput: (value: string) => (this.purchase.benefitNoteInput = value),
		setShowEarlyPaymentBenefitModal: (value: boolean) =>
			(this.purchase.showEarlyPaymentBenefitModal = value),
		resetEarlyPaymentState: this.resetEarlyPaymentState
	});

	purchaseSnapshot = (): PurchaseSubmitSnapshot => {
		const props = this.#props();
		return {
			purchaseOrderId: props.purchaseOrderId,
			hasRail: this.sel.rail != null,
			paymentMethod: this.sel.rail!,
			paymentDate: this.sel.paymentDate,
			rateType: this.values.rateType ?? undefined,
			referenceToSubmit: this.values.referenceToSubmit,
			notes: this.sel.notes,
			pendingBalanceUsd: props.pendingBalanceUsd,
			resolvedAmountUsd: this.values.resolvedAmountUsd,
			resolvedNativeAmount: this.values.resolvedNativeAmount,
			liveEarlyPaymentSuggestion: this.values.liveEarlyPaymentSuggestion,
			comparisonAmount: this.values.comparisonAmount,
			settlementRateToVes: this.values.settlementRateToVes,
			settlementDebtAmount: Number(props.purchaseOrder?.settlementDebtAmount ?? 0),
			settlementDebtAmountUsdBcvAtOrder: Number(
				props.purchaseOrder?.settlementDebtAmountUsdBcvAtOrder ?? 0
			),
			pendingAddPayload: this.purchase.pendingAddPayload,
			pendingBenefitSuggestion: this.purchase.pendingBenefitSuggestion,
			benefitAmountInput: this.purchase.benefitAmountInput,
			benefitNoteInput: this.purchase.benefitNoteInput,
			isNativeSettlement: this.values.isNativeSettlement,
			purchaseCurrencyCode: this.values.purchaseCurrencyCode,
			activeBcvRate: this.values.activeBcvRate,
			needsSpecificRate: this.values.needsSpecificRate,
			specificRateValue: this.values.specificRateValue,
			amountAppliedToDebt: this.values.amountAppliedToDebt
		};
	};

	handleSubmit = () => {
		const props = this.#props();
		if (props.kind === 'sale') {
			void submitSalePayment(
				{
					saleId: props.saleId,
					rail: this.sel.rail,
					paymentDate: this.sel.paymentDate,
					resolvedNativeAmount: this.values.resolvedNativeAmount,
					resolvedAmountUsd: this.values.resolvedAmountUsd,
					needsSpecificRate: this.values.needsSpecificRate,
					specificRateValue: this.values.specificRateValue,
					activeBcvRate: this.values.activeBcvRate,
					rateType: this.values.rateType ?? undefined,
					isCasheaSale: props.isCasheaSale ?? false,
					referenceToSubmit: this.values.referenceToSubmit,
					notes: this.sel.notes,
					remainingBcvUsd: props.remainingBcvUsd ?? 0,
					pendingAfterPayment: this.values.pendingAfterPayment
				},
				{
					setSubmitting: (value: boolean) => (this.submitting = value),
					reset: this.reset,
					partialReset: this.partialReset,
					onPaymentAdded: props.onPaymentAdded
				}
			);
		} else {
			void this.#purchaseApi.submit();
		}
	};

	confirmOverpayment = async () => {
		await this.#purchaseApi.confirmOverpayment();
	};

	cancelOverpayment = () => {
		this.#purchaseApi.cancelOverpayment();
	};

	applyBenefit = () => {
		void this.#purchaseApi.applyBenefit();
	};

	noteBenefit = () => {
		void this.#purchaseApi.noteBenefit();
	};

	cancelBenefit = () => {
		this.#purchaseApi.cancelBenefit();
	};
}
