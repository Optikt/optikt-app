<script lang="ts">
	import { CalendarDays, Tag, User } from '@lucide/svelte';
	import { autosize } from '$lib/actions/autosize';
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

<div class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
	<!-- Información general -->
	<section
		class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
	>
		<div class="mb-3 flex items-center gap-2">
			<CalendarDays class="h-4 w-4 text-brand-blue" />
			<h3 class="text-sm font-bold text-brand-navy dark:text-white">Información general</h3>
		</div>

		<div class="grid gap-3 sm:grid-cols-12">
			<div class="sm:col-span-4">
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

			<div class="sm:col-span-5">
				<p
					class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>
					Cliente
				</p>
				<div
					class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
				>
					<User class="h-4 w-4 shrink-0 text-slate-400" />
					<span class="truncate">{sale.customer?.firstName} {sale.customer?.lastName}</span>
				</div>
			</div>

			<div class="flex items-end sm:col-span-3">
				<CasheaCheckbox bind:isCashea compact />
			</div>

			<div class="sm:col-span-12">
				<label
					for="edit-sale-notes"
					class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
					>Observaciones</label
				>
				<textarea
					id="edit-sale-notes"
					bind:value={notes}
					rows="1"
					placeholder="Notas opcionales..."
					use:autosize={{ maxRows: 4 }}
					class="{inputClass} resize-none"></textarea>
			</div>
		</div>
	</section>

	<!-- Descuento -->
	<section
		class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
	>
		<div class="mb-3 flex items-center gap-2">
			<Tag class="h-4 w-4 text-brand-blue" />
			<h3 class="text-sm font-bold text-brand-navy dark:text-white">Descuento</h3>
		</div>

		<div class="space-y-3">
			<div>
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
					class={inputClass}
				/>
			</div>
		</div>
	</section>
</div>
