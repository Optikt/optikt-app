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
		onCommit: (item: EditableItem) => void;
		/** Unique blocking messages for the band's «Hecho» tooltip. */
		onMissing?: (labels: string[]) => void;
	}

	let { item, onCommit, onMissing }: Props = $props();

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

	/** Unique blocking messages for the band's «Hecho» tooltip (mirrors commit). */
	const missing = $derived.by(() => {
		const labels: string[] = [];
		if (name.trim().length < 3) labels.push('Describe el ítem (mínimo 3 caracteres).');
		if (!(unitPrice > 0)) labels.push('Indica un precio unitario mayor a 0.');
		return labels;
	});

	$effect(() => {
		onMissing?.(missing);
	});

	/** Exposed for the item band's «Hecho» button. */
	export function apply() {
		commit();
	}

	function commit() {
		if (missing.length > 0) {
			error = missing[0];
			return;
		}
		onCommit({
			...item,
			/** Placeholders join the basket with a local id (same as lens apply). */
			id: item.id ?? crypto.randomUUID(),
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

<div
	class="rounded-xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(21,35,70,0.06),0_2px_8px_rgba(21,35,70,0.06)]"
>
	<div class="flex flex-wrap items-end gap-2.5">
		<div class="w-44">
			<span
				class="mb-1 block text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase"
				>Nombre</span
			>
			<input
				type="text"
				bind:value={name}
				oninput={() => (error = '')}
				placeholder="Ej.: Examen visual"
				class="h-9 w-full rounded-lg border border-outline-variant/70 bg-white px-2.5 text-[13px] text-brand-navy transition outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
			/>
		</div>

		<div class="min-w-[200px] flex-1">
			<span
				class="mb-1 block text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase"
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
				class="mb-1 block text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase"
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

	<div class="mt-3">
		<PriceQtyFields
			{unitPrice}
			{quantity}
			{discount}
			{discountType}
			onPrice={(value) => {
				error = '';
				unitPrice = value;
			}}
			onQty={(value) => {
				error = '';
				quantity = value;
			}}
			onDiscount={(value) => {
				error = '';
				discount = value;
			}}
			onDiscountType={(value) => {
				error = '';
				discountType = value;
			}}
		/>
	</div>

	{#if error}
		<p class="mt-1.5 text-[10.5px] text-red-600 dark:text-red-400">{error}</p>
	{/if}
</div>
