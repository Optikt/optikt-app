<script lang="ts">
	import SearchCombobox from '$lib/components/ui/SearchCombobox.svelte';
	import { TriangleAlert, Eye, Package, Loader2 } from '@lucide/svelte';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { formatPrice, logger } from '$lib/utils';
	import { getProductTypeBadgeHex } from '$lib/shared/enums/productTypes';
	import { searchCatalog, getCatalogItemsByIds } from '$lib/remote/catalog.remote';
	import { cacheCatalogItems } from './catalogCache.svelte';

	const LENS_BADGE = { bg: '#eff6ff', text: '#3b82f6' } as const;

	function getIcon(opt: SelectOption) {
		return opt.productType ? getProductTypeIcon(opt.productType) : Eye;
	}

	function getBadge(productType: string): { bg: string; text: string } {
		return productType ? getProductTypeBadgeHex(productType) : LENS_BADGE;
	}

	interface Props {
		/** 'product' or 'lens' mode */
		kind: 'product' | 'lens';
		/** Selected product or lens ID */
		value: string;
		/** Label */
		label?: string;
		/** Callback when selection changes, passes unit price */
		onselect?: (id: string, unitPrice: number) => void;
	}

	let { kind, value = '', label, onselect }: Props = $props();

	interface SelectOption {
		id: string;
		label: string;
		name: string;
		sku: string;
		brand: string;
		stock: number | null;
		price: number;
		productType: string;
		source?: string;
		inventoryMode?: string;
	}

	let options = $state<SelectOption[]>([]);
	let searching = $state(false);
	let loadedValue = $state('');

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchSeq = 0;

	function mapProducts(list: ProductWithRelations[]): SelectOption[] {
		return list.map((p) => ({
			id: p.id,
			label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
			name: p.name,
			sku: p.sku ?? '',
			brand: p.brand?.name ?? '',
			stock: p.stock,
			price: p.currentSalePrice ?? 0,
			productType: p.type,
			source: undefined
		}));
	}

	function mapLenses(list: LensCatalogItemWithRelations[]): SelectOption[] {
		return list.map((l) => ({
			id: l.id,
			label: l.name,
			name: l.name,
			sku: '',
			brand: '',
			stock: l.stock,
			price: l.salePrice ?? l.basePrice,
			productType: '',
			source: l.source,
			inventoryMode: l.inventoryMode
		}));
	}

	async function runSearch(query: string) {
		const seq = ++searchSeq;
		searching = true;
		try {
			const results = await searchCatalog({ q: query, limit: 20 });
			if (seq !== searchSeq) return;
			cacheCatalogItems(results.products, results.lensItems);
			options = kind === 'product' ? mapProducts(results.products) : mapLenses(results.lensItems);
		} catch (e) {
			if (seq !== searchSeq) return;
			options = [];
			logger.error('Error en búsqueda de catálogo', e);
		} finally {
			if (seq === searchSeq) searching = false;
		}
	}

	function handleQueryChange(query: string) {
		clearTimeout(searchTimer);
		if (query.trim().length < 2) {
			options = [];
			return;
		}
		searchTimer = setTimeout(() => void runSearch(query.trim()), 250);
	}

	// Load the currently-selected item so the combobox shows its label.
	$effect(() => {
		if (value && value !== loadedValue) {
			loadedValue = value;
			void getCatalogItemsByIds(
				kind === 'product' ? { productIds: [value] } : { lensIds: [value] }
			).then((results) => {
				cacheCatalogItems(results.products, results.lensItems);
				options = kind === 'product' ? mapProducts(results.products) : mapLenses(results.lensItems);
			});
		}
	});

	const selectedOption = $derived(options.find((opt) => opt.id === value));
	const hasStockWarning = $derived(
		selectedOption?.inventoryMode === 'STOCK' &&
			selectedOption.stock !== null &&
			selectedOption.stock <= 0
	);
	const isOnDemand = $derived(
		!!value && kind === 'lens' && selectedOption?.inventoryMode === 'ON_DEMAND'
	);

	function handleChange(selected: SelectOption | null) {
		const newId = selected?.id ?? '';
		if (newId) {
			onselect?.(newId, selected?.price ?? 0);
		} else {
			onselect?.('', 0);
		}
	}

	const placeholder = $derived(kind === 'product' ? 'Buscar producto...' : 'Buscar lente...');
</script>

<div>
	{#if label}
		<p class="mb-1 text-sm font-medium text-on-surface-variant">{label}</p>
	{/if}

	<SearchCombobox
		{options}
		{placeholder}
		{value}
		getId={(s: unknown) => (s as SelectOption).id}
		getLabel={(s: unknown) => (s as SelectOption).label}
		onquerychange={handleQueryChange}
		onselect={(s: unknown) => handleChange(s as SelectOption)}
		onclear={() => handleChange(null)}
	>
		{#snippet children(opt)}
			{@const item = opt.option as SelectOption}
			{@const badge = getBadge(item.productType)}
			{@const Icon = getIcon(item)}
			<div class="flex items-center gap-2.5 py-0.5">
				<div
					class="flex h-7 w-7 min-w-7 items-center justify-center rounded-md"
					style:background={badge.bg}
					style:color={badge.text}
				>
					<Icon class="h-3.5 w-3.5" />
				</div>
				<div class="flex min-w-0 flex-1 flex-col gap-px">
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="font-semibold text-slate-800">{item.name}</span>
						{#if item.brand}
							<span class="text-xs text-slate-500">· {item.brand}</span>
						{/if}
						{#if item.stock !== null}
							{#if item.stock <= 0}
								<span class="rounded-full bg-red-50 px-1.5 py-px text-xs font-medium text-red-600">
									<strong>Sin stock</strong>
								</span>
							{:else if item.stock <= 3}
								<span class="text-xs font-medium text-amber-600">{item.stock} disp.</span>
							{:else}
								<span class="text-xs font-medium text-green-600">{item.stock} disp.</span>
							{/if}
						{:else if item.source}
							<span class="rounded-full bg-sky-50 px-1.5 py-px text-xs font-medium text-sky-600"
								>Por pedido</span
							>
						{/if}
					</div>
					<div class="flex items-center gap-2 text-[0.8rem]">
						{#if item.sku}
							<span class="font-mono text-slate-500">{item.sku}</span>
						{/if}
						<span class="font-semibold text-blue-800">{formatPrice(item.price)}</span>
						{#if searching && opt.highlighted}
							<Loader2 class="h-3.5 w-3.5 animate-spin text-slate-400" />
						{/if}
					</div>
				</div>
			</div>
		{/snippet}
	</SearchCombobox>

	{#if isOnDemand}
		<div
			class="mt-1.5 flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-sm font-medium text-sky-700"
		>
			<Package class="h-4 w-4 shrink-0" />
			<span>Se pedirá al proveedor</span>
		</div>
	{:else if hasStockWarning}
		{#if kind === 'lens'}
			<div
				class="mt-1.5 flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600"
			>
				<TriangleAlert class="h-4 w-4 shrink-0" />
				<span>Sin stock en inventario</span>
			</div>
		{:else}
			<div
				class="mt-1.5 flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600"
			>
				<TriangleAlert class="h-4 w-4 shrink-0" />
				<span>Este producto no tiene stock disponible</span>
			</div>
		{/if}
	{/if}
</div>
