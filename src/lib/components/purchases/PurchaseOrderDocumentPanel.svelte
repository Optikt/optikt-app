<script lang="ts">
	import SelectInput from '$lib/components/ui/SelectInput.svelte';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import { fieldLabelClass, inputClass } from './purchaseFieldStyles';
	import { PurchaseDocumentType } from '$lib/shared/enums';
	import { autoAnimate } from '@formkit/auto-animate';

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
	}

	let {
		suppliers,
		supplierId = $bindable(),
		supplierLocked = false,
		documentType = $bindable(),
		orderDate = $bindable(),
		invoiceNumber = $bindable(),
		deliveryNoteNumber = $bindable(),
		notes = $bindable()
	}: Props = $props();

	const isInvoice = $derived(documentType === PurchaseDocumentType.INVOICE);
	const notesTooShort = $derived(notes.length > 0 && notes.length < 6);
</script>

<div class="space-y-4">
	<div class="grid gap-4 lg:grid-cols-8">
		<div class="col-span-2 space-y-1.5 z-15">
			<p class={fieldLabelClass}>Proveedor</p>
			<SelectInput
				bind:value={supplierId}
				options={suppliers}
				placeholder="Buscar proveedor..."
				disabled={supplierLocked}
				valueField="id"
				labelField="name"
			/>
			{#if supplierLocked}
				<p class="text-xs leading-5 text-on-surface-variant">
					El proveedor queda bloqueado mientras existan líneas agregadas.
				</p>
			{/if}
		</div>

		<div class="col-span-2 space-y-1.5">
			<p class={fieldLabelClass}>Tipo de documento</p>
			<SegmentedToggle
				value={documentType}
				options={[
					{ value: PurchaseDocumentType.INVOICE, label: 'Factura' },
					{ value: PurchaseDocumentType.DELIVERY_NOTE, label: 'Nota' }
				]}
				onchange={(val) => (documentType = val as PurchaseDocumentType)}
			/>
		</div>

		<div class="col-span-2 space-y-1.5">
			{#if isInvoice}
				<p class={fieldLabelClass}>N° factura</p>
				<input
					type="text"
					bind:value={invoiceNumber}
					class={inputClass}
					placeholder="Número"
					aria-label="Número de factura"
				/>
			{:else}
				<p class={fieldLabelClass}>Nota de entrega</p>
				<input
					type="text"
					bind:value={deliveryNoteNumber}
					class={inputClass}
					placeholder="Número"
					aria-label="Nota de entrega"
				/>
			{/if}
		</div>

		<div class="col-span-2 space-y-1.5">
			<p class={fieldLabelClass}>Fecha de orden</p>
			<input type="date" bind:value={orderDate} class={inputClass} aria-label="Fecha de orden" />
		</div>
	</div>

	<div class="space-y-1.5" use:autoAnimate>
		<p class={fieldLabelClass}>
			Observaciones <span class="text-error">*</span>
		</p>
		<textarea
			bind:value={notes}
			rows="3"
			class={`${inputClass} min-h-[5rem] resize-y ${notesTooShort ? 'ring-1 ring-error/50' : ''}`}
			placeholder="Observaciones internas o acuerdos con proveedor..."
			aria-label="Observaciones"
			required
			minlength={6}></textarea>
		{#if notesTooShort}
			<p class="text-xs text-error">Mínimo 6 caracteres ({notes.length}/6)</p>
		{/if}
	</div>
</div>
