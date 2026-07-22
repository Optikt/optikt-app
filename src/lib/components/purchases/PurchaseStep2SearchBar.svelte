<script lang="ts">
	import { Search, X, Package, Eye, PlusCircle } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import { matchesAllTokens } from '$lib/utils/search';
	import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { PurchaseOrderItemType } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';

	interface QuickAddOption {
		key: string;
		id: string;
		kind: 'product' | 'lens';
		name: string;
		label: string;
		secondaryText: string;
		price: number;
	}

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		supplierId: string;
		pendingItemType: string;
		addedProductIds: Set<string>;
		addedLensIds: Set<string>;
		onselect: (id: string, kind: 'product' | 'lens') => void;
		disabled?: boolean;
	}

	let {
		products,
		lensItems,
		supplierId,
		pendingItemType,
		addedProductIds,
		addedLensIds,
		onselect,
		disabled = false
	}: Props = $props();

	let query = $state('');
	let open = $state(false);
	let inputEl: HTMLInputElement | null = $state(null);

	const supplierProducts = $derived(
		supplierId === '' ? [] : products.filter((p) => p.supplierId === supplierId)
	);
	const supplierLensItems = $derived(
		supplierId === '' ? [] : lensItems.filter((l) => l.supplierId === supplierId)
	);

	const productOptions = $derived(
		supplierProducts
			.filter((p) => !addedProductIds.has(p.id))
			.map((p) => ({
				key: `product:${p.id}`,
				id: p.id,
				kind: 'product' as const,
				name: p.name,
				label: `${p.sku} - ${p.name}`,
				secondaryText: [p.brand?.name, p.supplier?.name].filter(Boolean).join(' · '),
				price: p.currentSalePrice ?? 0
			}))
	);

	const lensOptions = $derived(
		supplierLensItems
			.filter((l) => !addedLensIds.has(l.id))
			.map((l) => ({
				key: `lens:${l.id}`,
				id: l.id,
				kind: 'lens' as const,
				name: l.name,
				label: l.name,
				secondaryText: [getLensTypeLabel(l.type), l.supplier?.name].filter(Boolean).join(' · '),
				price: l.salePrice ?? l.basePrice
			}))
	);

	const allOptions = $derived(
		pendingItemType === PurchaseOrderItemType.PRODUCT ? productOptions : lensOptions
	);

	const visibleOptions = $derived.by(() => {
		const q = query.trim();
		if (q.length === 0) return [];
		return allOptions.filter((opt) => {
			const searchable = `${opt.name} ${opt.secondaryText}`;
			return matchesAllTokens(q, searchable);
		});
	});

	const placeholder = $derived(
		supplierId === ''
			? 'Selecciona un proveedor primero'
			: pendingItemType === PurchaseOrderItemType.PRODUCT
				? 'Buscar producto por nombre o código...'
				: 'Buscar lente por nombre o tipo...'
	);

	function close() {
		open = false;
	}
	function reset() {
		query = '';
		open = false;
		inputEl?.focus();
	}
	function handleInput() {
		open = query.trim().length > 0;
	}
	function handleBlur() {
		setTimeout(() => {
			open = false;
		}, 200);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
			return;
		}
		if (e.key === 'Enter' && visibleOptions.length > 0) {
			e.preventDefault();
			onselect(visibleOptions[0].id, visibleOptions[0].kind);
			reset();
		}
	}
</script>

<div class="relative min-w-0 flex-1">
	<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline" />
	<input
		bind:this={inputEl}
		bind:value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onblur={handleBlur}
		onfocus={() => {
			if (query.trim().length > 0) open = true;
		}}
		{placeholder}
		disabled={disabled || supplierId === ''}
		class="w-full rounded-lg border border-outline-variant/40 bg-surface-container-high px-8 py-2.5 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
	/>
	{#if query}
		<button
			title="Limpiar búsqueda"
			type="button"
			onclick={reset}
			class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-outline transition-colors hover:text-on-surface"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	{/if}

	{#if open}
		<div
			class="absolute top-full left-0 right-0 z-30 mt-1.5 max-h-[40vh] overflow-y-auto rounded-xl border border-outline-variant/30 bg-white shadow-lg"
		>
			{#if visibleOptions.length > 0}
				{#each visibleOptions as opt (opt.key)}
					<button
						type="button"
						onclick={() => {
							onselect(opt.id, opt.kind);
							reset();
						}}
						class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low"
					>
						<div
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-brand-navy"
						>
							{#if opt.kind === 'product'}
								<Package class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-on-surface" title={opt.name}>
								{opt.label}
							</p>
							<p class="truncate text-xs text-on-surface-variant" title={opt.secondaryText}>
								{opt.secondaryText}
							</p>
						</div>
						<div class="shrink-0 text-right">
							<p class="font-mono text-sm font-medium text-brand-navy whitespace-nowrap">
								{formatPrice(opt.price)}
							</p>
						</div>
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue"
						>
							<PlusCircle class="h-3.5 w-3.5" />
						</div>
					</button>
				{/each}
			{:else if query.trim().length > 0}
				<div class="py-6 text-center">
					<p class="text-sm text-on-surface-variant">
						Sin resultados para &quot;{query.trim()}&quot;
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
