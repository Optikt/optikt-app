<script lang="ts">
	import { Calculator, ChevronDown, FileText } from '@lucide/svelte';
	import type { PurchaseOrderSummary } from './purchaseOrderDraft';
	import { formatPrice } from '$lib/utils';

	type SupplierOption = {
		id: string;
		name: string;
	};

	interface Props {
		suppliers: SupplierOption[];
		supplierId: string;
		supplierLocked?: boolean;
		orderDate: string;
		bcvRate: number;
		invoiceNumber: string;
		deliveryNoteNumber: string;
		notes: string;
		summary: PurchaseOrderSummary;
	}

	let {
		suppliers,
		supplierId = $bindable(),
		supplierLocked = false,
		orderDate = $bindable(),
		bcvRate = $bindable(),
		invoiceNumber = $bindable(),
		deliveryNoteNumber = $bindable(),
		notes = $bindable(),
		summary
	}: Props = $props();

	const fieldLabelClass =
		'text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase';
	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';
	const selectClass = `${inputClass} appearance-none pr-10`;

	const totalInBs = $derived(summary.total * Number(bcvRate || 0));

	function formatVes(amount: number): string {
		return `Bs. ${new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount)}`;
	}
</script>

<div class="space-y-6">
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

		<div class="mt-6 space-y-5">
			<div class="space-y-2">
				<p class={fieldLabelClass}>Proveedor</p>
				<div class="relative">
					<select
						bind:value={supplierId}
						class={selectClass}
						aria-label="Proveedor"
						disabled={supplierLocked}
					>
						<option value="">Seleccione un proveedor...</option>
						{#each suppliers as supplier (supplier.id)}
							<option value={supplier.id}>{supplier.name}</option>
						{/each}
					</select>
					<ChevronDown
						class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-outline"
					/>
				</div>
				{#if supplierLocked}
					<p class="text-xs leading-5 text-on-surface-variant">
						El proveedor queda bloqueado mientras existan líneas agregadas.
					</p>
				{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<p class={fieldLabelClass}>Fecha de orden</p>
					<input
						type="date"
						bind:value={orderDate}
						class={inputClass}
						aria-label="Fecha de orden"
					/>
				</div>

				<div class="space-y-2">
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
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<p class={fieldLabelClass}>N° factura</p>
					<input
						type="text"
						bind:value={invoiceNumber}
						class={inputClass}
						placeholder="Opcional"
						aria-label="Número de factura"
					/>
				</div>

				<div class="space-y-2">
					<p class={fieldLabelClass}>Nota de entrega</p>
					<input
						type="text"
						bind:value={deliveryNoteNumber}
						class={inputClass}
						placeholder="Opcional"
						aria-label="Nota de entrega"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<p class={fieldLabelClass}>Observaciones</p>
				<textarea
					bind:value={notes}
					rows="4"
					class={`${inputClass} min-h-[7rem] resize-y`}
					placeholder="Observaciones internas o acuerdos con proveedor..."
					aria-label="Observaciones"
				></textarea>
			</div>
		</div>
	</section>

	<section class="rounded-[1.75rem] bg-brand-navy p-5 text-white shadow-sm sm:p-6">
		<div class="flex items-start gap-3">
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-gold"
			>
				<Calculator class="h-5 w-5" />
			</div>
			<div>
				<p class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Resumen total</p>
				<h2 class="mt-1 text-xl font-semibold text-white">Vista económica de la orden</h2>
			</div>
		</div>

		<div class="mt-5 grid gap-3 sm:grid-cols-2">
			<div class="rounded-2xl bg-white/8 p-4">
				<p class="text-sm text-white/70">Costo estimado</p>
				<p class="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
					{formatPrice(summary.total)}
				</p>
			</div>
			<div class="rounded-2xl bg-white/8 p-4">
				<p class="text-sm text-white/70">Venta estimada</p>
				<p class="mt-2 font-mono text-2xl font-semibold text-brand-gold tabular-nums">
					{formatPrice(summary.estimatedSale)}
				</p>
			</div>
		</div>

		<div class="mt-5 space-y-3 rounded-2xl bg-white/6 p-4 text-sm text-white/70">
			<div class="flex items-center justify-between gap-4">
				<span>Subtotal</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{formatPrice(summary.subtotal)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>IVA estimado</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{formatPrice(summary.taxAmount)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>Líneas / Unidades</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{summary.lineCount} / {summary.totalUnits}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>Margen proyectado</span>
				<span class="font-mono text-base font-semibold text-brand-gold tabular-nums">
					{formatPrice(summary.estimatedProfit)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>Equivalente BCV</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{bcvRate > 0 ? formatVes(totalInBs) : 'Define una tasa'}
				</span>
			</div>
		</div>
	</section>
</div>
