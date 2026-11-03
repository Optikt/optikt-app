<script lang="ts">
	import { untrack } from 'svelte';
	import { DiscountType } from '$lib/shared/enums';
	import { ALL_FREE_ITEM_CATEGORIES } from '$lib/shared/enums/lensTypes';
	import type { FreeItemCategory } from '$lib/shared/enums/lensTypes';
	import PriceQtyFields from '$lib/components/commercialDocument/PriceQtyFields.svelte';
	import SearchCombobox from '$lib/components/ui/SearchCombobox.svelte';
	import type { EditableItem } from '../editSaleDraft';

	interface Props {
		item: EditableItem;
		mode: 'add' | 'edit';
		/** Hide the «Editando ítem libre / Hecho» row when a shell owns the band. */
		showHeader?: boolean;
		onCommit: (item: EditableItem) => void;
	}

	let { item, mode, onCommit, showHeader = true }: Props = $props();

	let name = $state(untrack(() => item.freeItemDescription ?? item.snapshotName ?? ''));
	let note = $state(untrack(() => item.notes ?? ''));
	let category = $state<FreeItemCategory>(
		untrack(
			() => (item.freeItemCategory as FreeItemCategory | undefined) ?? ALL_FREE_ITEM_CATEGORIES[0]
		)
	);
	let quantity = $state(untrack(() => item.quantity));
	let unitPrice = $state(untrack(() => item.unitPrice));
	let discount = $state(untrack(() => item.discount ?? 0));
	let discountType = $state<string>(untrack(() => item.discountType ?? DiscountType.FIXED));
	let error = $state('');

	/** Exposed for the item band's «Hecho» button. */
	export function apply() {
		commit();
	}

	function commit() {
		if (name.trim().length < 3) {
			error = 'Describe el ítem (mínimo 3 caracteres).';
			return;
		}
		if (unitPrice <= 0) {
			error = 'Indica un precio unitario mayor a 0.';
			return;
		}
		onCommit({
			...item,
			quantity,
			unitPrice,
			discount,
			discountType: discountType as DiscountType,
			freeItemCategory: category,
			freeItemDescription: name.trim(),
			snapshotName: name.trim(),
			notes: note.trim() || undefined
		});
	}
</script>

{#if showHeader}<div class="mb-2.5 flex items-center justify-between gap-2">
		<span
			class="text-[10.5px] font-extrabold tracking-[0.09em] text-on-info-container uppercase dark:text-brand-blue-light"
		>
			{mode === 'add' ? 'Nuevo ítem libre' : 'Editando ítem libre'}
		</span>
		<button
			type="button"
			onclick={commit}
			class="h-[26px] rounded-[7px] bg-brand-blue/10 px-3 text-xs font-bold text-brand-blue-dark transition hover:bg-brand-blue/15 dark:bg-brand-blue/20 dark:text-brand-blue-light"
		>
			Hecho ✓
		</button>
	</div>{/if}

<div class="flex flex-wrap items-end gap-2.5">
	<div class="w-44">
		<span
			class="mb-1 block text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>Nombre</span
		>
		<input
			type="text"
			bind:value={name}
			placeholder="Ej.: Examen visual"
			class="h-9 w-full rounded-lg border border-outline-variant/70 bg-white px-2.5 text-[13px] text-brand-navy transition outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
		/>
	</div>

	<div class="min-w-[200px] flex-1">
		<span
			class="mb-1 block text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>Descripción</span
		>
		<input
			type="text"
			bind:value={note}
			placeholder="Detalle del servicio o fórmula"
			class="h-9 w-full rounded-lg border border-outline-variant/70 bg-white px-2.5 text-[13px] text-brand-navy transition outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
		/>
	</div>

	<div class="min-w-[150px] flex-1">
		<span
			class="mb-1 block text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>Categoría</span
		>
		<SearchCombobox
			options={[...ALL_FREE_ITEM_CATEGORIES]}
			value={category}
			getId={(option: string | unknown) => String(option)}
			getLabel={(option: unknown) => String(option)}
			onselect={(option: unknown) => (category = String(option) as FreeItemCategory)}
			showIcon={false}
			placeholder="Categoría…"
		>
			{#snippet children({ option }: { option: unknown })}
				<span class="block text-sm font-semibold text-brand-navy">{String(option)}</span>
			{/snippet}
		</SearchCombobox>
	</div>
</div>

<div class="mt-2.5">
	<PriceQtyFields
		{unitPrice}
		{quantity}
		{discount}
		{discountType}
		onPrice={(value) => (unitPrice = value)}
		onQty={(value) => (quantity = value)}
		onDiscount={(value) => (discount = value)}
		onDiscountType={(value) => (discountType = value)}
	/>
</div>

{#if error}
	<p class="mt-1.5 text-[10.5px] text-red-600 dark:text-red-400">{error}</p>
{/if}
