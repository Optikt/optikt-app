<script lang="ts">
	import { slide } from 'svelte/transition';
	import { DiscountType } from '$lib/shared/enums';
	import { ALL_FREE_ITEM_CATEGORIES } from '$lib/shared/enums/lensTypes';
	import type { FreeItemCategory } from '$lib/shared/enums/lensTypes';

	interface Props {
		showAddFreeItem: boolean;
		addFreeCategory: FreeItemCategory;
		addFreeDescription: string;
		addFreePrice: number;
		addFreeDiscount: number;
		addFreeDiscountType: string;
		addFreeNotes: string;
		onAddFreeItem: () => void;
		onCancel: () => void;
	}

	let {
		showAddFreeItem,
		addFreeCategory = $bindable(),
		addFreeDescription = $bindable(),
		addFreePrice = $bindable(),
		addFreeDiscount = $bindable(),
		addFreeDiscountType = $bindable(),
		addFreeNotes = $bindable(),
		onAddFreeItem,
		onCancel
	}: Props = $props();
</script>

{#if showAddFreeItem}
	<div
		transition:slide={{ duration: 180 }}
		class="mb-3 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-slate-800"
	>
		<p class="mb-3 text-xs font-bold text-amber-800 dark:text-amber-300">Agregar ítem libre</p>
		<div class="space-y-3">
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label
						for="add-free-cat"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Categoría</label
					>
					<select
						id="add-free-cat"
						bind:value={addFreeCategory}
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					>
						{#each ALL_FREE_ITEM_CATEGORIES as cat (cat)}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>
				<div>
					<label
						for="add-free-price"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Precio venta</label
					>
					<input
						id="add-free-price"
						type="number"
						bind:value={addFreePrice}
						min="0"
						step="0.01"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					/>
				</div>
			</div>
			<div>
				<label
					for="add-free-desc"
					class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
					>Descripción</label
				>
				<input
					id="add-free-desc"
					type="text"
					bind:value={addFreeDescription}
					placeholder="Ej: Funda antivuelco"
					class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label
						for="add-free-discount"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Descuento</label
					>
					<input
						id="add-free-discount"
						type="number"
						bind:value={addFreeDiscount}
						min="0"
						step="0.01"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					/>
				</div>
				<div>
					<label
						for="add-free-discount-type"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Tipo</label
					>
					<select
						id="add-free-discount-type"
						bind:value={addFreeDiscountType}
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					>
						<option value={DiscountType.FIXED}>Fijo ($)</option>
						<option value={DiscountType.PERCENTAGE}>%</option>
					</select>
				</div>
			</div>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
					>Cancelar</button
				>
				<button
					type="button"
					onclick={onAddFreeItem}
					disabled={!addFreeDescription.trim() || addFreePrice <= 0}
					class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
					>Agregar</button
				>
			</div>
		</div>
	</div>
{/if}
