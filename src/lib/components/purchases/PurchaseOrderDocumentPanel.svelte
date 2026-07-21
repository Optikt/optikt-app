<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import SelectInput from '$lib/components/ui/SelectInput.svelte';
	import { PurchaseDocumentType, getPurchaseDocumentTypeLabel } from '$lib/shared/enums';
	import {
		sourceCurrencyRequiresRateToVes,
		getSourceCurrencySymbol
	} from '$lib/shared/purchaseOrderCurrencies';
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
		bcvRate: number;
		/** Source-to-VES rate (Bs per source-currency unit) — shown when sourceCurrency = EUR */
		sourceRateToVes: number;
		/** Source currency for item prices — determines whether sourceRateToVes field is visible */
		sourceCurrency: string;
		invoiceNumber: string;
		deliveryNoteNumber: string;
		notes: string;
		/** When true, renders content without the outer section wrapper and header */
		bare?: boolean;
	}

	let {
		suppliers,
		supplierId = $bindable(),
		supplierLocked = false,
		documentType = $bindable(),
		orderDate = $bindable(),
		bcvRate = $bindable(),
		sourceRateToVes = $bindable(),
		sourceCurrency,
		invoiceNumber = $bindable(),
		deliveryNoteNumber = $bindable(),
		notes = $bindable(),
		bare = false
	}: Props = $props();

	const fieldLabelClass =
		'text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase';
	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

	const isInvoice = $derived(documentType === PurchaseDocumentType.INVOICE);
	const notesTooShort = $derived(notes.length > 0 && notes.length < 6);
	const showSourceRate = $derived(sourceCurrencyRequiresRateToVes(sourceCurrency));
	const sourceSymbol = $derived(getSourceCurrencySymbol(sourceCurrency));
</script>

{#if bare}
	<div class="mt-5 space-y-4">
		<div class="grid gap-4 lg:grid-cols-8">
			<div class="col-span-2 space-y-1.5">
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
				<div class="flex w-full rounded-xl bg-surface-container-high p-0">
					{#each Object.values(PurchaseDocumentType) as docType (docType)}
						{@const isDocType = documentType === docType}
						<button
							type="button"
							onclick={() => (documentType = docType)}
							class={[
								'flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase transition-colors',
								isDocType
									? 'bg-brand-navy text-white'
									: 'text-on-surface-variant hover:text-brand-navy'
							]}
						>
							{getPurchaseDocumentTypeLabel(docType)}
						</button>
					{/each}
				</div>
				<p class="text-xs leading-5 text-on-surface-variant">
					{isInvoice
						? 'Los ítems se marcan con IVA 16% por defecto.'
						: 'Los ítems se marcan como exentos por defecto.'}
				</p>
			</div>

			<div class="col-span-2 space-y-1.5">
				{#if isInvoice}
					<p class={fieldLabelClass}>N° factura</p>
					<input
						type="text"
						bind:value={invoiceNumber}
						class={inputClass}
						placeholder="Opcional"
						aria-label="Número de factura"
					/>
				{:else}
					<p class={fieldLabelClass}>Nota de entrega</p>
					<input
						type="text"
						bind:value={deliveryNoteNumber}
						class={inputClass}
						placeholder="Opcional"
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
{:else}
	<section class="glass-card bg-surface-container-lowest p-5 sm:p-6">
		<div class="flex items-start gap-3">
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-brand-blue"
			>
				<FileText class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-brand-navy">Información del documento</h2>
			</div>
		</div>

		<div class="mt-5 space-y-4">
			<div class="grid gap-4 lg:grid-cols-8">
				<div class="col-span-2 space-y-1.5">
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
					<div class="flex w-full rounded-xl bg-surface-container-high p-0">
						{#each Object.values(PurchaseDocumentType) as docType (docType)}
							{@const isDocType = documentType === docType}
							<button
								type="button"
								onclick={() => (documentType = docType)}
								class={[
									'flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase transition-colors',
									isDocType
										? 'bg-brand-navy text-white'
										: 'text-on-surface-variant hover:text-brand-navy'
								]}
							>
								{getPurchaseDocumentTypeLabel(docType)}
							</button>
						{/each}
					</div>
					<p class="text-xs leading-5 text-on-surface-variant">
						{isInvoice
							? 'Los ítems se marcan con IVA 16% por defecto.'
							: 'Los ítems se marcan como exentos por defecto.'}
					</p>
				</div>

				<div class="col-span-2 space-y-1.5">
					{#if isInvoice}
						<p class={fieldLabelClass}>N° factura</p>
						<input
							type="text"
							bind:value={invoiceNumber}
							class={inputClass}
							placeholder="Opcional"
							aria-label="Número de factura"
						/>
					{:else}
						<p class={fieldLabelClass}>Nota de entrega</p>
						<input
							type="text"
							bind:value={deliveryNoteNumber}
							class={inputClass}
							placeholder="Opcional"
							aria-label="Nota de entrega"
						/>
					{/if}
				</div>

				<div class="col-span-2 space-y-1.5">
					<p class={fieldLabelClass}>Fecha de orden</p>
					<input
						type="date"
						bind:value={orderDate}
						class={inputClass}
						aria-label="Fecha de orden"
					/>
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="space-y-1.5">
					<p class={fieldLabelClass}>Tasa BCV</p>
					<input
						type="number"
						step="0.01"
						min="0"
						bind:value={bcvRate}
						class={inputClass}
						placeholder="Ej: 38.25"
						aria-label="Tasa BCV"
					/>
				</div>

				{#if showSourceRate}
					<div class="space-y-1.5">
						<p class={fieldLabelClass}>Tasa {sourceSymbol} (Bs/{sourceSymbol})</p>
						<input
							type="number"
							step="0.01"
							min="0"
							bind:value={sourceRateToVes}
							class={inputClass}
							placeholder="Ej: 41.30"
							aria-label={`Tasa ${sourceSymbol} en bolívares`}
						/>
					</div>
				{/if}

				<div
					class="space-y-1.5 {showSourceRate
						? 'sm:col-span-2 lg:col-span-2'
						: 'sm:col-span-1 lg:col-span-3'}"
					use:autoAnimate
				>
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
		</div>
	</section>
{/if}
