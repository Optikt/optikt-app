<script lang="ts">
	import { getContext } from 'svelte';
	import { Search, X, Package, Eye } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import { getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { allowsDuplicateProductLines } from '../includedAccessories';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';

	interface QuickAddOption {
		key: string;
		id: string;
		kind: 'product' | 'lens';
		name: string;
		label: string;
		secondaryText: string;
		stock: number | null;
		brandId?: string | null;
		productType?: string;
		inventoryMode?: string;
		price: number;
	}

	interface Props {
		filter: 'all' | 'product' | 'lens';
		items: { productId: string; kind: string }[];
		onselect: (option: QuickAddOption) => void;
	}

	let { filter, items, onselect }: Props = $props();

	const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY);

	let quickAddQuery = $state('');
	let quickAddOpen = $state(false);

	const quickAddPlaceholder = $derived.by(() => {
		if (filter === 'product') return 'Buscar producto por nombre o código...';
		if (filter === 'lens') return 'Buscar lente por nombre, material o tipo...';
		return 'Buscar items...';
	});

	const quickAddOptions = $derived.by((): QuickAddOption[] => {
		const selectedProductIds = new Set(
			items
				.filter((item) => item.kind === 'product' && item.productId !== '')
				.filter((item) => {
					const selectedProduct = products.find((candidate) => candidate.id === item.productId);
					return !allowsDuplicateProductLines(selectedProduct?.type);
				})
				.map((item) => item.productId)
		);

		const productOptions =
			filter === 'lens'
				? []
				: products.flatMap((product) => {
						if (selectedProductIds.has(product.id)) return [];
						if (product.stock !== null && product.stock <= 0) return [];
						const secondaryBits = [product.brand?.name, product.sku].filter(
							(value): value is string => Boolean(value)
						);
						return [
							{
								key: `product:${product.id}`,
								id: product.id,
								kind: 'product' as const,
								name: product.name,
								label: product.sku ? `${product.name} (${product.sku})` : product.name,
								secondaryText: secondaryBits.join(' · '),
								stock: product.stock,
								brandId: product.brandId ?? null,
								productType: product.type,
								price: product.currentSalePrice ?? 0
							}
						];
					});

		const lensOptions =
			filter === 'product'
				? []
				: lensItems.map((lens) => {
						const secondaryBits = [
							getLensSourceLabel(lens.source),
							getLensTypeLabel(lens.type),
							lens.material?.name
						].filter((value): value is string => Boolean(value));
						return {
							key: `lens:${lens.id}`,
							id: lens.id,
							kind: 'lens' as const,
							name: lens.name,
							label: lens.name,
							secondaryText: secondaryBits.join(' · '),
							stock: lens.stock,
							inventoryMode: lens.inventoryMode,
							price: lens.salePrice ?? lens.basePrice
						};
					});

		return [...productOptions, ...lensOptions];
	});

	const visibleQuickAddOptions = $derived.by(() => {
		const query = quickAddQuery.trim().toLowerCase();
		if (query.length < 2) return [];
		return quickAddOptions.filter((option) => {
			const searchableText = `${option.name} ${option.label} ${option.secondaryText}`.toLowerCase();
			return searchableText.includes(query);
		});
	});

	const visibleProductQuickAddOptions = $derived(
		visibleQuickAddOptions.filter((o) => o.kind === 'product')
	);
	const visibleLensQuickAddOptions = $derived(
		visibleQuickAddOptions.filter((o) => o.kind === 'lens')
	);
	const totalQuickAddResults = $derived(visibleQuickAddOptions.length);

	function closeQuickAdd() {
		quickAddOpen = false;
	}
	function resetQuickAdd() {
		quickAddQuery = '';
		quickAddOpen = false;
	}
	function handleQuickAddInput() {
		quickAddOpen = quickAddQuery.trim().length >= 2;
	}
	function handleQuickAddBlur() {
		setTimeout(() => {
			quickAddOpen = false;
		}, 200);
	}
	function handleQuickAddKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeQuickAdd();
			return;
		}
		if (event.key === 'Enter' && visibleQuickAddOptions.length > 0) {
			event.preventDefault();
			onselect(visibleQuickAddOptions[0]);
			resetQuickAdd();
		}
	}
</script>

<div class="relative min-w-0 flex-1 lg:max-w-3xl">
	<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
	<input
		bind:value={quickAddQuery}
		oninput={handleQuickAddInput}
		onkeydown={handleQuickAddKeydown}
		onblur={handleQuickAddBlur}
		onfocus={() => {
			if (quickAddQuery.trim().length >= 2) quickAddOpen = true;
		}}
		placeholder={quickAddPlaceholder}
		class="w-full rounded-lg border border-slate-200 bg-white px-8 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
	/>
	{#if quickAddQuery}
		<button
			title="Limpiar búsqueda"
			type="button"
			onclick={resetQuickAdd}
			class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	{/if}

	{#if quickAddOpen}
		<div
			class="wmax absolute top-full right-0 left-0 z-30 mt-1.5 max-h-[420px] max-w-full min-w-[600px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
		>
			{#if totalQuickAddResults > 0}
				{#if visibleProductQuickAddOptions.length > 0}
					<div class="border-b border-slate-100 px-3 pt-2.5 pb-1">
						<div
							class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-slate-400 uppercase"
						>
							<Package class="h-3 w-3" />
							Productos ({visibleProductQuickAddOptions.length})
						</div>
					</div>
					{#each visibleProductQuickAddOptions as option (option.key)}
						<button
							type="button"
							onclick={() => {
								onselect(option);
								resetQuickAdd();
							}}
							class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
						>
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
							>
								<Package class="h-4 w-4" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-800" title={option.name}>
									{option.name}
								</p>
								<p class="truncate text-xs text-slate-500" title={option.secondaryText}>
									{option.secondaryText}
								</p>
							</div>
							<div class="text-right">
								<p class="font-mono text-sm font-medium whitespace-nowrap text-slate-700">
									{formatPrice(option.price)}
								</p>
								{#if option.stock !== null}<p class="text-[11px] font-medium text-emerald-600">
										{option.stock} disp.
									</p>{/if}
							</div>
						</button>
					{/each}
				{/if}

				{#if visibleLensQuickAddOptions.length > 0}
					<div class="border-b border-slate-100 px-3 pt-2.5 pb-1">
						<div
							class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-slate-400 uppercase"
						>
							<Eye class="h-3 w-3" />
							Lentes ({visibleLensQuickAddOptions.length})
						</div>
					</div>
					{#each visibleLensQuickAddOptions as option (option.key)}
						<button
							type="button"
							onclick={() => {
								onselect(option);
								resetQuickAdd();
							}}
							class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
						>
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500"
							>
								<Eye class="h-4 w-4" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-800" title={option.name}>
									{option.name}
								</p>
								<p class="truncate text-xs text-slate-500" title={option.secondaryText}>
									{option.secondaryText}
								</p>
							</div>
							<div class="text-right">
								<p class="font-mono text-sm font-medium whitespace-nowrap text-slate-700">
									{formatPrice(option.price)}
								</p>
								{#if option.inventoryMode === 'ON_DEMAND'}
									<p class="text-[11px] font-medium text-blue-600">Por pedido</p>
								{:else if option.stock !== null}
									<p class="text-[11px] font-medium text-slate-500">{option.stock} disp.</p>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			{:else}
				<div class="py-6 text-center">
					<p class="text-sm text-slate-500">
						Sin resultados para &quot;{quickAddQuery.trim()}&quot;
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
