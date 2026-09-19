<script lang="ts">
	import { PaymentFormModel } from './payments/paymentFormModel.svelte';
	import PurchasePaymentModals from './payments/PurchasePaymentModals.svelte';
	import PaymentRailSection from './payments/PaymentRailSection.svelte';
	import { PaymentSelectionStep } from '$lib/components/payments';
	import type { PaymentFormProps } from './payments/paymentFormDerived';

	let {
		kind,
		saleId,
		remainingBcvUsd = 0,
		onPaymentAdded,
		isCasheaSale = $bindable(false),
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

	const model = new PaymentFormModel(() => ({
		kind,
		saleId,
		remainingBcvUsd,
		onPaymentAdded,
		isCasheaSale,
		purchaseOrderId,
		status,
		defaultBcvRate,
		purchaseOrder,
		payments: _payments,
		earlyPaymentBenefits,
		pendingBalanceUsd,
		debtTotalUsd,
		isFullyPaid,
		settlementCurrency,
		composerRequest,
		onFinanceChanged,
		bcvRate,
		drawerResetKey,
		variant
	}));

	const sel = model.sel;

	$effect(() => model.syncDrawerReset(drawerResetKey));
	$effect(() => model.applyComposerRequest());
	$effect(() => model.preselectNativeSettlement());
</script>

<div class="space-y-4">
	<PaymentSelectionStep
		currencyKey={sel.currencyKey}
		rail={sel.rail}
		railsByCurrency={model.values.railsByCurrency}
		onSelectCurrency={model.selectCurrency}
		onSelectRail={model.selectRail}
	/>

	{#if sel.rail}
		<PaymentRailSection
			{kind}
			rail={sel.rail}
			{variant}
			paymentDate={sel.paymentDate}
			usdFieldValue={model.values.usdFieldValue}
			nativeFieldValue={model.values.nativeFieldValue}
			nativeLabel={model.values.nativeLabel}
			nativePrefix={model.values.nativePrefix}
			debtBalanceUsd={model.values.debtBalanceUsd}
			resolvedAmountUsd={model.values.resolvedAmountUsd}
			resolvedUsdDisplay={model.values.resolvedUsdDisplay}
			rateContextLine={model.values.rateContextLine}
			bcvRateInput={sel.bcvRateInput}
			defaultBcvRateInput={model.values.defaultBcvRateInput}
			needsSpecificRate={model.values.needsSpecificRate}
			specificRateLabel={model.values.specificRateLabel}
			specificRateInput={sel.specificRateInput}
			autoSpecificRate={model.values.autoSpecificRate}
			bind:isCasheaSale
			reference={sel.reference}
			notes={sel.notes}
			referenceLabel={model.values.referenceConfig.label}
			referencePlaceholder={model.values.referenceConfig.placeholder}
			referenceRequired={model.values.referenceConfig.required}
			referenceHelper={model.values.referenceConfig.helper}
			overpaymentAmount={model.values.overpaymentAmount}
			overpaymentDisplay={model.values.overpaymentDisplay}
			pendingAfterPayment={model.values.pendingAfterPayment}
			restLabelClass={model.values.restLabelClass}
			showPurchasePreview={model.values.showPurchasePreview}
			purchaseNormalized={model.values.purchaseNormalized}
			isNativeSettlement={model.values.isNativeSettlement}
			amountAppliedToDebt={model.values.amountAppliedToDebt}
			settlementSymbol={model.values.settlementSymbol}
			exchangeVariance={model.values.exchangeVariance}
			liveEarlyPaymentSuggestion={model.values.liveEarlyPaymentSuggestion}
			canSubmit={model.canSubmit}
			drawerSubmitLabel={model.drawerSubmitLabel}
			submitLabel={model.submitLabel}
			onDateInput={(value) => (sel.paymentDate = value)}
			onUsdInput={model.handleUsdInput}
			onNativeInput={model.handleNativeInput}
			onBcvRateInput={(value) => (sel.bcvRateInput = value)}
			onSpecificRateInput={(value) => (sel.specificRateInput = value)}
			onUseRemainingBalance={model.useRemainingBalance}
			onReference={(value) => (sel.reference = value)}
			onNotes={(value) => (sel.notes = value)}
			onSubmit={model.handleSubmit}
		/>
	{/if}
</div>

{#if kind === 'purchase'}
	<PurchasePaymentModals
		bind:showOverpaymentModal={model.purchase.showOverpaymentModal}
		bind:showEarlyPaymentBenefitModal={model.purchase.showEarlyPaymentBenefitModal}
		pendingAddPayload={model.purchase.pendingAddPayload}
		pendingBenefitSuggestion={model.purchase.pendingBenefitSuggestion}
		bind:benefitAmountInput={model.purchase.benefitAmountInput}
		bind:benefitNoteInput={model.purchase.benefitNoteInput}
		submitting={model.submitting}
		resolvedUsdDisplay={model.values.resolvedUsdDisplay}
		{pendingBalanceUsd}
		overpaymentDisplay={model.values.overpaymentDisplay}
		onConfirmOverpayment={model.confirmOverpayment}
		onCancelOverpayment={model.cancelOverpayment}
		onBenefitApply={model.applyBenefit}
		onBenefitNote={model.noteBenefit}
		onCancelBenefit={model.cancelBenefit}
	/>
{/if}
