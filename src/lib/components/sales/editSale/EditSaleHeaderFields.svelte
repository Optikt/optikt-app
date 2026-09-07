<script lang="ts">
	import { CalendarDays, Tag } from '@lucide/svelte';
	import { DiscountType } from '$lib/shared/enums';
	import CasheaCheckbox from '../CasheaCheckbox.svelte';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';
	import { User } from '@lucide/svelte';

	interface Props {
		sale: SaleWithRelations;
		saleDate: string;
		notes: string;
		isCashea: boolean;
		discount: number;
		discountType: string;
		reason: string;
		reasonError: string;
	}

	let {
		sale,
		saleDate = $bindable(),
		notes = $bindable(),
		isCashea = $bindable(),
		discount = $bindable(),
		discountType = $bindable(),
		reason = $bindable(),
		reasonError
	}: Props = $props();
</script>

<section
	class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50"
>
	<div class="mb-4 flex items-center gap-2">
		<CalendarDays class="h-4 w-4 text-brand-blue" />
		<h3 class="text-sm font-bold text-brand-navy dark:text-white">Información General</h3>
	</div>
	<div class="grid gap-4 md:grid-cols-3">
		<div>
			<label
				for="edit-sale-date"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Fecha de venta</label
			>
			<input
				id="edit-sale-date"
				type="date"
				bind:value={saleDate}
				class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"
			/>
		</div>
		<div>
			<label
				for="edit-customer"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Cliente</label
			>
			<div
				class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>
				<User class="h-4 w-4 text-slate-400" />
				<span class="truncate">{sale.customer?.firstName} {sale.customer?.lastName}</span>
			</div>
		</div>
		<div>
			<label
				for="edit-sale-notes"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Observaciones</label
			>
			<input
				id="edit-sale-notes"
				type="text"
				bind:value={notes}
				placeholder="Notas opcionales..."
				class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"
			/>
		</div>
		<CasheaCheckbox bind:isCashea class="mt-2" />
	</div>
</section>

<section
	class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50"
>
	<div class="mb-4 flex items-center gap-2">
		<Tag class="h-4 w-4 text-brand-blue" />
		<h3 class="text-sm font-bold text-brand-navy dark:text-white">Descuento</h3>
	</div>
	<div class="grid gap-4 md:grid-cols-2">
		<div>
			<label
				for="edit-discount-type"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Tipo</label
			>
			<select
				id="edit-discount-type"
				bind:value={discountType}
				class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"
			>
				<option value={DiscountType.FIXED}>Monto fijo ($)</option>
				<option value={DiscountType.PERCENTAGE}>Porcentaje (%)</option>
			</select>
		</div>
		<div>
			<label
				for="edit-discount"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
			>
				Valor {discountType === DiscountType.PERCENTAGE ? '(%)' : '($)'}
			</label>
			<input
				id="edit-discount"
				type="number"
				bind:value={discount}
				min="0"
				step="0.01"
				class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"
			/>
		</div>
	</div>
</section>

<div>
	<label
		for="edit-reason"
		class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
		>Motivo de la edición *</label
	>
	<input
		id="edit-reason"
		type="text"
		bind:value={reason}
		placeholder="Ej: Corrección de precio, cambio de cristal..."
		class="w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:ring-2 focus:outline-none {reasonError
			? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200 dark:border-red-600 dark:bg-red-900/20'
			: 'border-slate-300 bg-white focus:border-brand-blue focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800'} text-slate-800 dark:text-white"
	/>
	{#if reasonError}
		<p class="mt-1 text-xs text-red-600 dark:text-red-400">{reasonError}</p>
	{/if}
</div>
