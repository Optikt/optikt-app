<script lang="ts">
	import { slide } from 'svelte/transition';
	import { DiscountType } from '$lib/shared/enums';
	import ItemSelect from '../ItemSelect.svelte';

	interface Props {
		showAddProduct: boolean;
		addProductId: string;
		addProductQty: number;
		addProductPrice: number;
		addProductDiscount: number;
		addProductDiscountType: string;
		addProductNotes: string;
		onSelectProduct: (id: string, unitPrice: number) => void;
		onAddProduct: () => void;
		onCancel: () => void;
	}

	let {
		showAddProduct = $bindable(),
		addProductId = $bindable(),
		addProductQty = $bindable(),
		addProductPrice = $bindable(),
		addProductDiscount = $bindable(),
		addProductDiscountType = $bindable(),
		addProductNotes = $bindable(),
		onSelectProduct,
		onAddProduct,
		onCancel
	}: Props = $props();
</script>

{#if showAddProduct}
	<div
		transition:slide={{ duration: 180 }}
		class="mb-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800"
	>
		<p class="mb-3 text-xs font-bold text-brand-navy dark:text-white">Agregar producto</p>
		<div class="space-y-3">
			<ItemSelect kind="product" value={addProductId} onselect={onSelectProduct} label="Producto" />
			<div class="grid grid-cols-3 gap-3">
				<div>
					<label
						for="add-prod-qty"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Cant.</label
					>
					<input
						id="add-prod-qty"
						type="number"
						bind:value={addProductQty}
						min="1"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					/>
				</div>
				<div>
					<label
						for="add-prod-price"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Precio</label
					>
					<input
						id="add-prod-price"
						type="number"
						bind:value={addProductPrice}
						min="0"
						step="0.01"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					/>
				</div>
				<div>
					<label
						for="add-prod-discount"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Desc.</label
					>
					<input
						id="add-prod-discount"
						type="number"
						bind:value={addProductDiscount}
						min="0"
						step="0.01"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					/>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<select
					bind:value={addProductDiscountType}
					class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
				>
					<option value={DiscountType.FIXED}>Fijo ($)</option>
					<option value={DiscountType.PERCENTAGE}>%</option>
				</select>
				<input
					type="text"
					bind:value={addProductNotes}
					placeholder="Notas (opcional)"
					class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
				/>
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
					onclick={onAddProduct}
					disabled={!addProductId}
					class="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
					>Agregar</button
				>
			</div>
		</div>
	</div>
{/if}
