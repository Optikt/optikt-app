<script lang="ts">
	import { CalendarDays, Tag, User } from '@lucide/svelte';
	import { DiscountType } from '$lib/shared/enums';
	import CasheaCheckbox from '../CasheaCheckbox.svelte';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleWithRelations;
		saleDate: string;
		notes: string;
		isCashea: boolean;
		discount: number;
		discountType: string;
	}

	let {
		sale,
		saleDate = $bindable(),
		notes = $bindable(),
		isCashea = $bindable(),
		discount = $bindable(),
		discountType = $bindable()
	}: Props = $props();

	const inputClass =
		'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light';
</script>

<section
	class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
>
	<div class="mb-3 flex items-center gap-2">
		<CalendarDays class="h-4 w-4 text-brand-blue" />
		<h3 class="text-sm font-bold text-brand-navy dark:text-white">Información general</h3>
	</div>

	<div class="grid gap-3 sm:grid-cols-12">
		<div class="sm:col-span-3">
			<label
				for="edit-sale-date"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Fecha de venta</label
			>
			<input
				id="edit-sale-date"
				type="date"
				bind:value={saleDate}
				class="{inputClass} max-w-[190px]"
			/>
		</div>

		<div class="sm:col-span-4">
			<label
				for="edit-customer"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Cliente</label
			>
			<div
				class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>
				<User class="h-4 w-4 shrink-0 text-slate-400" />
				<span class="truncate">{sale.customer?.firstName} {sale.customer?.lastName}</span>
			</div>
		</div>

		<div class="flex items-end sm:col-span-5">
			<CasheaCheckbox bind:isCashea />
		</div>

		<div class="sm:col-span-12">
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
				class={inputClass}
			/>
		</div>
	</div>

	<div class="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
		<div class="mb-2 flex items-center gap-2">
			<Tag class="h-3.5 w-3.5 text-brand-blue" />
			<span
				class="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>Descuento</span
			>
		</div>
		<div class="grid gap-3 sm:grid-cols-12">
			<div class="sm:col-span-3">
				<label
					for="edit-discount-type"
					class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
					>Tipo</label
				>
				<select id="edit-discount-type" bind:value={discountType} class={inputClass}>
					<option value={DiscountType.FIXED}>Monto fijo ($)</option>
					<option value={DiscountType.PERCENTAGE}>Porcentaje (%)</option>
				</select>
			</div>
			<div class="sm:col-span-2">
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
					class={inputClass}
				/>
			</div>
		</div>
	</div>
</section>
