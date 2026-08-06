<script lang="ts">
	import { Plus, Glasses, Package } from '@lucide/svelte';
	import { matchesAllTokens } from '$lib/utils/search';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import SearchCombobox from '$lib/components/ui/SearchCombobox.svelte';

	type SearchOption = {
		key: string;
		id: string;
		kind: 'product' | 'lens';
		label: string;
		secondaryText: string;
		price: number;
	};

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		addedProductIds: Set<string>;
		addedLensIds: Set<string>;
		currencySymbol: string;
		onselect: (id: string, kind: 'product' | 'lens') => void;
		disabled?: boolean;
	}

	let {
		products,
		lensItems,
		addedProductIds,
		addedLensIds,
		currencySymbol,
		onselect,
		disabled = false
	}: Props = $props();

	let pendingItemType = $state<'product' | 'lens'>('product');

	const typeOptions = [
		{ value: 'product', label: 'Productos' },
		{ value: 'lens', label: 'Lentes' }
	];

	const productOptions: SearchOption[] = $derived(
		products
			.filter((p) => !addedProductIds.has(p.id))
			.map((p) => ({
				key: `p-${p.id}`,
				id: p.id,
				kind: 'product' as const,
				label: `${p.sku} - ${p.name}`,
				secondaryText: p.brand ? `${p.brand.name}` : '',
				price: p.currentSalePrice ?? 0
			}))
	);

	const lensOptions: SearchOption[] = $derived(
		lensItems
			.filter((l) => !addedLensIds.has(l.id))
			.map((l) => ({
				key: `l-${l.id}`,
				id: l.id,
				kind: 'lens' as const,
				label: l.name,
				secondaryText: l.type ?? '',
				price: l.salePrice ?? l.basePrice ?? 0
			}))
	);

	const currentOptions = $derived(pendingItemType === 'product' ? productOptions : lensOptions);

	function handleSelect(option: unknown) {
		const opt = option as SearchOption;
		onselect(opt.id, opt.kind);
	}
</script>

<div class="flex flex-col sm:flex-row sm:items-start gap-2">
	<div class="sm:w-52 shrink-0">
		<SegmentedToggle
			value={pendingItemType}
			options={typeOptions}
			onchange={(val) => {
				pendingItemType = val as 'product' | 'lens';
			}}
		/>
	</div>
	<div class="flex-1 min-w-0">
		<SearchCombobox
			options={currentOptions}
			placeholder="Buscar producto por nombre o código…"
			{disabled}
			clearOnSelect={true}
			getId={(s: unknown) => (s as SearchOption).key}
			getLabel={(s: unknown) => (s as SearchOption).label}
			filterFn={(query: string, s: unknown) => {
				const opt = s as SearchOption;
				return matchesAllTokens(query, `${opt.label} ${opt.secondaryText}`);
			}}
			onselect={handleSelect}
			onclear={() => {}}
		>
			{#snippet children(opt)}
				{@const item = opt.option as SearchOption}
				<div class="flex w-full items-center gap-3 px-3 py-2 text-sm">
					<div
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-container-high text-on-surface-variant"
					>
						{#if item.kind === 'lens'}
							<Glasses class="h-3.5 w-3.5" />
						{:else}
							<Package class="h-3.5 w-3.5" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-on-surface">{item.label}</p>
						<p class="truncate text-[10px] text-on-surface-variant">{item.secondaryText}</p>
					</div>
					<span class="shrink-0 text-xs font-semibold text-brand-navy tabular-nums">
						{currencySymbol}{item.price.toFixed(2)}
					</span>
					<Plus class="h-4 w-4 shrink-0 text-brand-blue" aria-hidden="true" />
				</div>
			{/snippet}
		</SearchCombobox>
	</div>
</div>
