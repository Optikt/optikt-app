<script lang="ts">
	import { FileText, Settings } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import { PurchaseDocumentType, PurchasePaymentTerms } from '$lib/shared/enums';
	import { inputClass } from '../purchaseFieldStyles';
	import FieldWrapper from './FieldWrapper.svelte';
	import PurchaseOrderCreditDrawer from './PurchaseOrderCreditDrawer.svelte';
	import SupplierCombobox from './SupplierCombobox.svelte';

	type SupplierOption = {
		id: string;
		name: string;
	};

	interface Props {
		suppliers: SupplierOption[];
		supplierId: string;
		supplierLocked?: boolean;
		documentType: PurchaseDocumentType;
		orderDate: string;
		invoiceNumber: string;
		deliveryNoteNumber: string;
		notes: string;
		paymentTerms: PurchasePaymentTerms;
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
		onPaymentTermsChange?: (value: PurchasePaymentTerms) => void;
		onCreditDueDateChange?: (value: string | null) => void;
		onEarlyPaymentDiscountPercentChange?: (value: number | null) => void;
		onEarlyPaymentDiscountDeadlineChange?: (value: string | null) => void;
	}

	let {
		suppliers,
		supplierId = $bindable(),
		supplierLocked = false,
		documentType = $bindable(),
		orderDate = $bindable(),
		invoiceNumber = $bindable(),
		deliveryNoteNumber = $bindable(),
		notes = $bindable(),
		paymentTerms,
		creditDueDate,
		earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline,
		onPaymentTermsChange,
		onCreditDueDateChange,
		onEarlyPaymentDiscountPercentChange,
		onEarlyPaymentDiscountDeadlineChange
	}: Props = $props();

	let creditDrawerOpen = $state(false);
	let prevDocumentType: PurchaseDocumentType | null = $state(null);

	const isInvoice = $derived(documentType === PurchaseDocumentType.INVOICE);
	const notesTooShort = $derived(notes.length > 0 && notes.length < 6);
	const isCredit = $derived(paymentTerms === PurchasePaymentTerms.CREDIT);
	const creditConfigured = $derived(isCredit && !!creditDueDate);

	$effect(() => {
		if (prevDocumentType !== null && prevDocumentType !== documentType) {
			if (documentType === PurchaseDocumentType.INVOICE) {
				deliveryNoteNumber = '';
			} else {
				invoiceNumber = '';
			}
		}
		prevDocumentType = documentType;
	});

	function handlePaymentTermsChange(val: string) {
		const next = val as PurchasePaymentTerms;
		onPaymentTermsChange?.(next);
		if (next === PurchasePaymentTerms.CONTADO) {
			creditDrawerOpen = false;
			onCreditDueDateChange?.(null);
			onEarlyPaymentDiscountPercentChange?.(null);
			onEarlyPaymentDiscountDeadlineChange?.(null);
		}
	}
</script>

<div class="@container rounded-2xl bg-surface-container-low p-4 ring-1 ring-outline-variant/20">
	<h2 class="text-sm font-bold tracking-[0.16em] text-brand-navy uppercase mb-4">
		<FileText class="mr-2 inline-block h-4 w-4 text-brand-blue" />
		Documento y condición de pago
	</h2>

	<!-- Proveedor (full width) -->
	<FieldWrapper label="Proveedor" required>
		<SupplierCombobox {suppliers} bind:value={supplierId} disabled={supplierLocked} />
		{#if supplierLocked}
			<p class="text-xs leading-5 text-on-surface-variant">
				El proveedor queda bloqueado mientras existan líneas agregadas.
			</p>
		{/if}
	</FieldWrapper>

	<!-- Secondary fields (container query grid) -->
	<div class="grid grid-cols-1 @sm:grid-cols-3 gap-4 mt-4">
		<FieldWrapper label="Documento">
			<SegmentedToggle
				value={documentType}
				options={[
					{ value: PurchaseDocumentType.INVOICE, label: 'Factura' },
					{ value: PurchaseDocumentType.DELIVERY_NOTE, label: 'Nota' }
				]}
				onchange={(val) => (documentType = val as PurchaseDocumentType)}
			/>
		</FieldWrapper>
		<FieldWrapper label={isInvoice ? 'N° factura' : 'Nota'}>
			{#if isInvoice}
				<input type="text" bind:value={invoiceNumber} class={inputClass} placeholder="Opcional" />
			{:else}
				<input
					type="text"
					bind:value={deliveryNoteNumber}
					class={inputClass}
					placeholder="Número"
				/>
			{/if}
		</FieldWrapper>
		<FieldWrapper label="Fecha de orden">
			<input type="date" bind:value={orderDate} class={inputClass} />
		</FieldWrapper>
	</div>

	<!-- Observaciones (full width) -->
	<FieldWrapper label="Observaciones" required class="mt-4">
		<textarea
			bind:value={notes}
			rows="3"
			class={`${inputClass} min-h-[3rem] h-[3rem] max-h-[5rem] resize-y ${notesTooShort ? 'ring-1 ring-error/50' : ''}`}
			placeholder="Observaciones internas o acuerdos con proveedor..."></textarea>
		<div use:autoAnimate>
			{#if notesTooShort}
				<p class="text-xs text-error">Mínimo 6 caracteres ({notes.length}/6)</p>
			{/if}
		</div>
	</FieldWrapper>

	<!-- Divider -->
	<hr class="border-outline-variant/40 my-2" />

	<!-- Condición de pago -->
	<p class="text-[10px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase mb-2">
		Condición de pago
	</p>
	<div class="flex items-center gap-3">
		<div class="flex-1">
			<SegmentedToggle
				value={paymentTerms}
				options={[
					{ value: PurchasePaymentTerms.CONTADO, label: 'Contado' },
					{ value: PurchasePaymentTerms.CREDIT, label: 'Crédito' }
				]}
				onchange={handlePaymentTermsChange}
			/>
		</div>
		<button
			type="button"
			onclick={() => (creditDrawerOpen = true)}
			disabled={!isCredit}
			title="Configurar crédito"
			class="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<Settings class="h-5 w-5" />
		</button>
	</div>

	<div use:autoAnimate>
		<!-- Crédito summary or hint -->
		{#if isCredit}
			{#if creditConfigured}
				<p class="text-sm text-on-surface-variant mt-2">
					Vence el {creditDueDate}
					{#if earlyPaymentDiscountPercent && earlyPaymentDiscountDeadline}
						· Pronto pago {earlyPaymentDiscountPercent}% antes del {earlyPaymentDiscountDeadline}
					{/if}
				</p>
			{:else}
				<p class="text-sm text-on-surface-variant/80 mt-2 italic">
					Configura las condiciones del crédito usando el botón de ajustes
				</p>
			{/if}
		{/if}
	</div>
</div>

<PurchaseOrderCreditDrawer
	bind:open={creditDrawerOpen}
	{creditDueDate}
	{earlyPaymentDiscountPercent}
	{earlyPaymentDiscountDeadline}
	{onCreditDueDateChange}
	{onEarlyPaymentDiscountPercentChange}
	{onEarlyPaymentDiscountDeadlineChange}
/>
