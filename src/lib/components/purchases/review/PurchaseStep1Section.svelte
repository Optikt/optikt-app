<script lang="ts">
	import type {
		PurchaseDiscountType,
		PurchaseDocumentType,
		PurchasePaymentTerms
	} from '$lib/shared/enums';
	import PurchaseOrderStep1Card1 from '../step1/PurchaseOrderStep1Card1.svelte';
	import PurchaseOrderStep1Card2 from '../step1/PurchaseOrderStep1Card2.svelte';

	interface SupplierOption {
		id: string;
		name: string;
	}

	interface Props {
		suppliers: SupplierOption[];
		supplierId: string;
		supplierLocked: boolean;
		documentType: PurchaseDocumentType;
		orderDate: string;
		invoiceNumber: string;
		deliveryNoteNumber: string;
		notes: string;
		paymentTerms: PurchasePaymentTerms;
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
		sourceCurrency: string;
		bcvRate: number;
		sourceRateToVes: number;
		settlementCurrency: string;
		settlementManuallyChanged: boolean;
		discountType: PurchaseDiscountType;
		discountValue: number;
		discountNotes: string;
		settlementCurrencyConflict: boolean;
		onPaymentTermsChange: (terms: PurchasePaymentTerms) => void;
		onSourceCurrencyChange: (value: string) => void;
	}

	let {
		suppliers,
		supplierId = $bindable(),
		supplierLocked,
		documentType = $bindable(),
		orderDate = $bindable(),
		invoiceNumber = $bindable(),
		deliveryNoteNumber = $bindable(),
		notes = $bindable(),
		paymentTerms,
		creditDueDate = $bindable(),
		earlyPaymentDiscountPercent = $bindable(),
		earlyPaymentDiscountDeadline = $bindable(),
		sourceCurrency = $bindable(),
		bcvRate = $bindable(),
		sourceRateToVes = $bindable(),
		settlementCurrency = $bindable(),
		settlementManuallyChanged = $bindable(),
		discountType = $bindable(),
		discountValue = $bindable(),
		discountNotes = $bindable(),
		settlementCurrencyConflict,
		onPaymentTermsChange,
		onSourceCurrencyChange
	}: Props = $props();
</script>

<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
	<PurchaseOrderStep1Card1
		{suppliers}
		bind:supplierId
		{supplierLocked}
		bind:documentType
		bind:orderDate
		bind:invoiceNumber
		bind:deliveryNoteNumber
		bind:notes
		{paymentTerms}
		{creditDueDate}
		{earlyPaymentDiscountPercent}
		{earlyPaymentDiscountDeadline}
		{onPaymentTermsChange}
		onCreditDueDateChange={(value) => (creditDueDate = value)}
		onEarlyPaymentDiscountPercentChange={(value) => (earlyPaymentDiscountPercent = value)}
		onEarlyPaymentDiscountDeadlineChange={(value) => (earlyPaymentDiscountDeadline = value)}
	/>

	<PurchaseOrderStep1Card2
		bind:sourceCurrency
		bind:bcvRate
		bind:sourceRateToVes
		{settlementCurrency}
		{settlementManuallyChanged}
		bind:discountType
		bind:discountValue
		bind:discountNotes
		{onSourceCurrencyChange}
		onBcvRateChange={(val) => (bcvRate = val)}
		onSourceRateToVesChange={(val) => (sourceRateToVes = val)}
		onSettlementManuallyChangedChange={(val) => (settlementManuallyChanged = val)}
		onSettlementCurrencyChange={(val) => (settlementCurrency = val)}
		onDiscountTypeChange={(val) => (discountType = val)}
		onDiscountValueChange={(val) => (discountValue = val)}
		onDiscountNotesChange={(val) => (discountNotes = val)}
		{settlementCurrencyConflict}
	/>
</div>
