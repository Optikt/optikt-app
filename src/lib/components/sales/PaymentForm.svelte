<script lang="ts">
	import { untrack } from 'svelte';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { formatPrice } from '$lib/utils';
	import { PaymentMethod } from '$lib/shared/enums';
	import {
		computeAutoSpecificRate,
		computeEffectiveBcvRate,
		computeHasRequiredReference,
		computeIsNativeSettlement,
		computeNativeLabel,
		computeNativePrefix,
		computeNeedsSpecificRate,
		computePurchaseCurrencyCode,
		computeRailsByCurrency,
		computeRateContextLine,
		computeRateType,
		computeReferenceConfig,
		computeReferenceToSubmit,
		computeRestLabelClass,
		computeSaleForwardUsd,
		computeSaleReverseNative,
		computeSelectedCurrency,
		computeSettlementSymbol,
		computeSpecificRateLabel,
		type PaymentComposerRequest,
		type PaymentFormProps
	} from './payments/paymentFormDerived';
	import {
		computeAmountAppliedToDebt,
		computeExchangeVariance,
		computeLiveEarlyPaymentSuggestion,
		computePurchaseNormalized,
		computePurchaseReverseNative,
		computeShowPurchasePreview,
		createPurchaseSubmitApi,
		submitPurchasePayment,
		type PurchaseFlowMutations,
		type PurchaseSubmitSnapshot
	} from './payments/purchasePayment';
	import { submitSalePayment } from './payments/salePaymentSubmit';
	import { PaymentFormSelection } from './payments/paymentFormSelection.svelte';
	import PurchasePaymentModals from './payments/PurchasePaymentModals.svelte';
	import PaymentRailSection from './payments/PaymentRailSection.svelte';
	import { PaymentSelectionStep } from '$lib/components/payments';
	import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';

	interface ReferenceConfig {
		label: string;
		required: boolean;
		placeholder: string;
		helper?: string;
		fallbackValue?: string;
	}

	let {
		kind,
		saleId,
		remainingBcvUsd = 0,
		onPaymentAdded,
		isCasheaSale = false,
		purchaseOrderId,
		status,
		defaultBcvRate = 0,
		purchaseOrder,
		payments: _payments = [],
		earlyPaymentBenefits = [],
		pendingBalanceUsd,
		debtTotalUsd,
		isFullyPaid = false,
		settlementCurrency,
		composerRequest = null,
		onFinanceChanged,
		bcvRate = 0,
		drawerResetKey = 0,
		variant = 'default'
	}: PaymentFormProps = $props();

	const store = getExchangeRatesStore();
	const storeBcvRate = $derived(store.bcvRate);
	const eurRate = $derived(store.rates.find((r) => r.code === 'EUR')?.value ?? 0);
	const usdtRate = $derived(store.rates.find((r) => r.sourceKey === 'usdt')?.value ?? 0);
	const paypalRate = $derived(store.rates.find((r) => r.code === 'PAYPAL')?.value ?? 0);
	const effectiveBcvRate = $derived(
		computeEffectiveBcvRate(kind, defaultBcvRate, bcvRate, storeBcvRate)
	);
	const defaultBcvRateInput = $derived(effectiveBcvRate > 0 ? effectiveBcvRate.toFixed(2) : '');

	const sel = new PaymentFormSelection();

	let submitting = $state(false);
	let showOverpaymentModal = $state(false);
	let pendingAddPayload = $state<Parameters<typeof submitPurchasePayment>[0] | null>(null);
	let showEarlyPaymentBenefitModal = $state(false);
	let pendingBenefitSuggestion = $state<EarlyPaymentDiscountSuggestion | null>(null);
	let benefitAmountInput = $state('');
	let benefitNoteInput = $state('');

	const canManagePurchasePayments = $derived(
		kind === 'purchase' && status === 'CONFIRMED' && !isFullyPaid
	);
	const isNativeSettlement = $derived(computeIsNativeSettlement(kind, settlementCurrency));
	const settlementSymbol = $derived(
		computeSettlementSymbol(isNativeSettlement, settlementCurrency)
	);
	const railsByCurrency = $derived(computeRailsByCurrency(kind));
	const selectedCurrency = $derived(computeSelectedCurrency(sel.currencyKey));
	const rateType = $derived(computeRateType(sel.rail, sel.currencyKey));
	const purchaseCurrencyCode = $derived(computePurchaseCurrencyCode(sel.rail));
	const needsSpecificRate = $derived(computeNeedsSpecificRate(sel.rail, sel.currencyKey));
	const specificRateLabel = $derived(computeSpecificRateLabel(sel.rail, selectedCurrency));
	const autoSpecificRate = $derived(
		computeAutoSpecificRate(sel.rail, sel.currencyKey, eurRate, usdtRate, paypalRate)
	);

	function inputToNumber(value: string): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	function formatInputValue(value: number): string {
		return value > 0 ? value.toFixed(2) : '';
	}

	const activeBcvRate = $derived(inputToNumber(sel.bcvRateInput || defaultBcvRateInput));
	const specificRateValue = $derived(inputToNumber(sel.specificRateInput));
	const typedNativeAmount = $derived(inputToNumber(sel.nativeAmountInput));
	const typedUsdBcvAmount = $derived(inputToNumber(sel.usdBcvAmountInput));

	// ----- Amount conversions (kind-specific) -----
	const saleForwardUsd = $derived(
		computeSaleForwardUsd(kind, sel.rail, typedNativeAmount, activeBcvRate, specificRateValue)
	);
	const saleReverseNative = $derived(
		computeSaleReverseNative(kind, sel.rail, typedUsdBcvAmount, activeBcvRate, specificRateValue)
	);
	const purchaseNormalized = $derived(
		computePurchaseNormalized({
			purchaseCurrencyCode,
			typedNativeAmount,
			typedUsdBcvAmount,
			activeBcvRate,
			specificRateValue,
			needsSpecificRate
		})
	);
	const purchaseReverseNative = $derived(
		computePurchaseReverseNative({
			purchaseCurrencyCode,
			typedNativeAmount,
			typedUsdBcvAmount,
			activeBcvRate,
			specificRateValue,
			needsSpecificRate
		})
	);

	const forwardUsd = $derived(kind === 'sale' ? saleForwardUsd : purchaseNormalized.amountUsdBcv);
	const reverseNative = $derived(kind === 'sale' ? saleReverseNative : purchaseReverseNative);
	const resolvedAmountUsd = $derived(
		sel.lastEditedAmount === 'usd' ? typedUsdBcvAmount : forwardUsd
	);
	const resolvedNativeAmount = $derived(
		sel.lastEditedAmount === 'native' ? typedNativeAmount : reverseNative
	);
	const usdFieldValue = $derived(
		sel.lastEditedAmount === 'usd' ? sel.usdBcvAmountInput : formatInputValue(forwardUsd)
	);
	const nativeFieldValue = $derived(
		sel.lastEditedAmount === 'native' ? sel.nativeAmountInput : formatInputValue(reverseNative)
	);

	// ----- Settlement (purchase) -----
	const amountAppliedToDebt = $derived(
		computeAmountAppliedToDebt({
			isNativeSettlement,
			purchaseCurrencyCode,
			specificRateValue,
			settlementCurrency,
			resolvedNativeAmount
		})
	);
	const exchangeVariance = $derived(
		computeExchangeVariance({
			isNativeSettlement,
			amountAppliedToDebt,
			debtTotalUsd,
			resolvedAmountUsd
		})
	);

	// ----- Remaining / overpayment -----
	const debtBalanceUsd = $derived(kind === 'sale' ? remainingBcvUsd : (pendingBalanceUsd ?? 0));

	const overpaymentAmount = $derived(Math.max(0, resolvedAmountUsd - debtBalanceUsd));
	const pendingAfterPayment = $derived(Math.max(0, debtBalanceUsd - resolvedAmountUsd));
	const restLabelClass = $derived(computeRestLabelClass(overpaymentAmount, pendingAfterPayment));

	// ----- Early payment suggestion (purchase) -----
	const hasActiveEarlyPaymentBenefit = $derived(
		earlyPaymentBenefits.some((benefit) => !benefit.voidedAt)
	);
	const liveEarlyPaymentSuggestion = $derived(
		computeLiveEarlyPaymentSuggestion({
			kind,
			hasActiveEarlyPaymentBenefit,
			pendingBalanceUsd,
			debtTotalUsd,
			purchaseOrder,
			resolvedAmountUsd,
			paymentDate: sel.paymentDate
		})
	);
	const showPurchasePreview = $derived(
		computeShowPurchasePreview({
			purchaseNormalizedAmountBs: purchaseNormalized.amountBs,
			resolvedAmountUsd,
			isNativeSettlement,
			amountAppliedToDebt,
			liveEarlyPaymentSuggestion
		})
	);

	const resolvedUsdDisplay = $derived(formatPrice(resolvedAmountUsd));
	const overpaymentDisplay = $derived(formatPrice(overpaymentAmount));

	// ----- Reference config (from payment method strategy registry) -----
	const referenceConfig: ReferenceConfig = $derived(computeReferenceConfig(sel.rail));
	const referenceToSubmit = $derived(computeReferenceToSubmit(sel.reference, referenceConfig));
	const hasRequiredReference = $derived(
		computeHasRequiredReference(referenceConfig, sel.reference)
	);

	// ----- Native display (from payment method strategy registry) -----
	const nativeLabel = $derived(computeNativeLabel(sel.rail));
	const nativePrefix = $derived(computeNativePrefix(sel.rail));
	const rateContextLine = $derived(
		computeRateContextLine({
			resolvedAmountUsd,
			activeBcvRate,
			kind,
			purchaseCurrencyCode,
			rail: sel.rail,
			specificRateValue
		})
	);

	function reset() {
		sel.reset();
	}

	function partialReset() {
		sel.partialReset();
	}

	function resetForm(request: PaymentComposerRequest | null = null) {
		sel.resetFromRequest(request);
	}

	let prevDrawerResetKey = 0;
	$effect(() => {
		const key = drawerResetKey;
		if (key !== prevDrawerResetKey) {
			prevDrawerResetKey = key;
			reset();
		}
	});

	let lastComposerToken = '';
	$effect(() => {
		if (kind !== 'purchase' || !composerRequest || !canManagePurchasePayments) return;
		if (composerRequest.token === lastComposerToken) return;
		untrack(() => {
			lastComposerToken = composerRequest.token;
			resetForm(composerRequest);
		});
	});

	// Pre-select settlement rate context for native settlements (purchase)
	$effect(() => {
		if (kind !== 'purchase' || !isNativeSettlement || sel.currencyKey) return;
		const map: Record<string, string> = {
			EUR_BCV: 'EUR_BCV',
			USDT: 'USDT',
			USD_PAYPAL: 'PAYPAL'
		};
		const key = map[settlementCurrency!];
		if (!key) return;
		sel.currencyKey = key;
		sel.rail = PaymentMethod.TRANSFERENCIA_BS;
		const orderRate = purchaseOrder?.sourceRateToVes;
		if (orderRate != null && orderRate > 0) sel.specificRateInput = String(orderRate);
	});

	// ----- Selection handlers -----
	function selectCurrency(key: string) {
		sel.selectCurrency(key);
	}

	function selectRail(method: PaymentMethod) {
		sel.selectRail(method, autoSpecificRate);
	}

	function handleNativeInput(event: Event) {
		sel.handleNativeInput(event);
	}

	function handleUsdInput(event: Event) {
		sel.handleUsdInput(event);
	}

	function useRemainingBalance() {
		sel.useRemainingBalance(kind, debtBalanceUsd, formatInputValue);
	}

	// ----- Submit -----
	function resetEarlyPaymentState() {
		showEarlyPaymentBenefitModal = false;
		pendingBenefitSuggestion = null;
		benefitAmountInput = '';
		benefitNoteInput = '';
	}

	function purchaseCallbacks(): PurchaseFlowMutations {
		return {
			setSubmitting: (value) => (submitting = value),
			onFinanceChanged,
			partialReset,
			setPendingAddPayload: (payload) => (pendingAddPayload = payload),
			setShowOverpaymentModal: (value) => (showOverpaymentModal = value),
			setPendingBenefitSuggestion: (suggestion) => (pendingBenefitSuggestion = suggestion),
			setBenefitAmountInput: (value) => (benefitAmountInput = value),
			setBenefitNoteInput: (value) => (benefitNoteInput = value),
			setShowEarlyPaymentBenefitModal: (value) => (showEarlyPaymentBenefitModal = value),
			resetEarlyPaymentState
		};
	}

	function purchaseSnapshot(): PurchaseSubmitSnapshot {
		return {
			purchaseOrderId,
			hasRail: sel.rail != null,
			paymentMethod: sel.rail!,
			paymentDate: sel.paymentDate,
			rateType: rateType ?? undefined,
			referenceToSubmit,
			notes: sel.notes,
			pendingBalanceUsd,
			resolvedAmountUsd,
			resolvedNativeAmount,
			liveEarlyPaymentSuggestion,
			pendingAddPayload,
			pendingBenefitSuggestion,
			benefitAmountInput,
			benefitNoteInput,
			isNativeSettlement,
			purchaseCurrencyCode,
			activeBcvRate,
			needsSpecificRate,
			specificRateValue,
			amountAppliedToDebt
		};
	}

	const purchaseApi = $derived(createPurchaseSubmitApi(purchaseSnapshot, purchaseCallbacks()));

	function handleSubmit() {
		if (kind === 'sale') {
			void submitSalePayment(
				{
					saleId,
					rail: sel.rail,
					paymentDate: sel.paymentDate,
					resolvedNativeAmount,
					resolvedAmountUsd,
					needsSpecificRate,
					specificRateValue,
					activeBcvRate,
					rateType: rateType ?? undefined,
					isCasheaSale,
					referenceToSubmit,
					notes: sel.notes,
					remainingBcvUsd,
					pendingAfterPayment
				},
				{
					setSubmitting: (value) => (submitting = value),
					reset,
					partialReset,
					onPaymentAdded
				}
			);
		} else {
			void purchaseApi.submit();
		}
	}

	async function handleConfirmOverpayment() {
		await purchaseApi.confirmOverpayment();
	}

	function handleCancelOverpayment() {
		purchaseApi.cancelOverpayment();
	}

	function handleBenefitApply() {
		void purchaseApi.applyBenefit();
	}

	function handleBenefitNote() {
		void purchaseApi.noteBenefit();
	}

	function handleCancelBenefit() {
		purchaseApi.cancelBenefit();
	}

	const hasValidAmounts = $derived(resolvedAmountUsd > 0 && resolvedNativeAmount > 0);
	const hasValidRate = $derived(activeBcvRate > 0 && (!needsSpecificRate || specificRateValue > 0));
	const canSubmit = $derived(
		!!sel.rail &&
			!!sel.currencyKey &&
			hasValidAmounts &&
			hasValidRate &&
			!!sel.paymentDate &&
			hasRequiredReference &&
			!submitting
	);
	const drawerSubmitLabel = $derived(
		kind === 'sale' && pendingAfterPayment <= 0.01 ? 'Finalizar Venta' : 'Aplicar Pago'
	);
	const submitLabel = $derived(
		hasValidAmounts ? `Registrar abono de ${formatPrice(resolvedAmountUsd)}` : 'Registrar pago'
	);
</script>

<div class="space-y-4">
	<PaymentSelectionStep
		currencyKey={sel.currencyKey}
		rail={sel.rail}
		{railsByCurrency}
		onSelectCurrency={(key) => selectCurrency(key)}
		onSelectRail={(m) => selectRail(m)}
	/>

	{#if sel.rail}
		<PaymentRailSection
			{kind}
			rail={sel.rail}
			{variant}
			paymentDate={sel.paymentDate}
			{usdFieldValue}
			{nativeFieldValue}
			{nativeLabel}
			{nativePrefix}
			{debtBalanceUsd}
			{resolvedAmountUsd}
			{resolvedUsdDisplay}
			{rateContextLine}
			bcvRateInput={sel.bcvRateInput}
			{defaultBcvRateInput}
			{needsSpecificRate}
			{specificRateLabel}
			specificRateInput={sel.specificRateInput}
			{autoSpecificRate}
			bind:isCasheaSale
			reference={sel.reference}
			notes={sel.notes}
			referenceLabel={referenceConfig.label}
			referencePlaceholder={referenceConfig.placeholder}
			referenceRequired={referenceConfig.required}
			referenceHelper={referenceConfig.helper}
			{overpaymentAmount}
			{overpaymentDisplay}
			{pendingAfterPayment}
			{restLabelClass}
			{showPurchasePreview}
			{purchaseNormalized}
			{isNativeSettlement}
			{amountAppliedToDebt}
			{settlementSymbol}
			{exchangeVariance}
			{liveEarlyPaymentSuggestion}
			{canSubmit}
			{drawerSubmitLabel}
			{submitLabel}
			onDateInput={(value) => (sel.paymentDate = value)}
			onUsdInput={handleUsdInput}
			onNativeInput={handleNativeInput}
			onBcvRateInput={(value) => (sel.bcvRateInput = value)}
			onSpecificRateInput={(value) => (sel.specificRateInput = value)}
			onUseRemainingBalance={useRemainingBalance}
			onReference={(value) => (sel.reference = value)}
			onNotes={(value) => (sel.notes = value)}
			onSubmit={handleSubmit}
		/>
	{/if}
</div>

{#if kind === 'purchase'}
	<PurchasePaymentModals
		bind:showOverpaymentModal
		bind:showEarlyPaymentBenefitModal
		{pendingAddPayload}
		{pendingBenefitSuggestion}
		bind:benefitAmountInput
		bind:benefitNoteInput
		{submitting}
		{resolvedUsdDisplay}
		{pendingBalanceUsd}
		{overpaymentDisplay}
		onConfirmOverpayment={handleConfirmOverpayment}
		onCancelOverpayment={handleCancelOverpayment}
		onBenefitApply={handleBenefitApply}
		onBenefitNote={handleBenefitNote}
		onCancelBenefit={handleCancelBenefit}
	/>
{/if}
