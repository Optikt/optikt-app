<script lang="ts">
	import { Search, Package, Microscope, X, Glasses, Sun, Eye } from '@lucide/svelte';
	import { universalSearch } from '$lib/remote/search.remote';
	import type { SearchResults } from '$lib/remote/search.remote';
	import { getLensTypeLabel } from '$lib/shared/enums';
	import { getProductTypeLabel } from '$lib/shared/enums/productTypes';
	import { formatPrice } from '$lib/utils';
	import { resolve } from '$app/paths';

	const PRODUCT_TYPE_ICONS: Record<string, typeof Package> = {
		FRAME: Glasses,
		SUNGLASSES: Sun,
		CONTACT_LENS: Eye,
		ACCESSORY: Package
	};

	const PRODUCT_TYPE_ICON_CLASSES: Record<string, string> = {
		FRAME: 'bg-blue-100 text-blue-600',
		SUNGLASSES: 'bg-green-100 text-green-600',
		CONTACT_LENS: 'bg-purple-100 text-purple-600',
		ACCESSORY: 'bg-yellow-100 text-yellow-600'
	};

	let searchQuery = $state('');
	let results = $state<SearchResults | null>(null);
	let isOpen = $state(false);
	let loading = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	let debounceTimer: ReturnType<typeof setTimeout>;

	// TODO: Improve the search experience and results (this maybe need a change in
	// the backend to return more relevant results and not just a dumb search by name)
	function handleInput() {
		clearTimeout(debounceTimer);
		const q = searchQuery.trim();

		if (!q || q.length < 2) {
			results = null;
			isOpen = false;
			return;
		}

		isOpen = true;
		debounceTimer = setTimeout(async () => {
			loading = true;
			try {
				results = await universalSearch({ query: q });
			} catch (e) {
				console.error(e);
				results = null;
			} finally {
				loading = false;
			}
		}, 250);
	}

	function close() {
		isOpen = false;
		searchQuery = '';
		results = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function handleBlur() {
		// Delay to allow click on results
		setTimeout(() => {
			isOpen = false;
		}, 200);
	}

	const totalResults = $derived((results?.products.length ?? 0) + (results?.lenses.length ?? 0));
</script>

<div class="relative w-full max-w-md">
	<!-- Search input -->
	<div class="relative">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
		<input
			bind:this={inputEl}
			bind:value={searchQuery}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			onfocus={() => {
				if (searchQuery.trim().length >= 2) isOpen = true;
			}}
			placeholder="Buscar productos, lentes... (+3.50 -2.00)"
			class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-10 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
		/>
		{#if searchQuery}
			<button
				onclick={close}
				class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}
	</div>

	<!-- Dropdown results -->
	{#if isOpen}
		<div
			class="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
		>
			{#if loading}
				<div class="flex items-center justify-center py-6">
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
					<span class="ml-2 text-sm text-slate-500">Buscando...</span>
				</div>
			{:else if results && totalResults > 0}
				<!-- Products section -->
				{#if results.products.length > 0}
					<div class="border-b border-slate-100 px-3 pt-2.5 pb-1">
						<div
							class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-slate-400 uppercase"
						>
							<Package class="h-3 w-3" />
							Productos ({results.products.length})
						</div>
					</div>
					{#each results.products as product (product.id)}
						{@const ProductIcon = PRODUCT_TYPE_ICONS[product.type] ?? Package}
						{@const iconClasses =
							PRODUCT_TYPE_ICON_CLASSES[product.type] ?? 'bg-slate-100 text-slate-500'}
						<a
							href={resolve(`/products/${product.id}`)}
							class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
							onclick={close}
						>
							<div class="flex h-8 w-8 items-center justify-center rounded-lg {iconClasses}">
								<ProductIcon class="h-4 w-4" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-800">{product.name}</p>
								<p class="truncate text-xs text-slate-500">
									{getProductTypeLabel(product.type)}
									{#if product.brand}· {product.brand}{/if}
									{#if product.supplier}· {product.supplier}{/if}
								</p>
							</div>
							<span class="font-mono text-sm font-medium whitespace-nowrap text-slate-700">
								{formatPrice(product.salePrice)}
							</span>
						</a>
					{/each}
				{/if}

				<!-- Lab lenses section -->
				{#if results.lenses.length > 0}
					<div class="border-b border-slate-100 px-3 pt-2.5 pb-1">
						<div
							class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-slate-400 uppercase"
						>
							<Microscope class="h-3 w-3" />
							Laboratorio ({results.lenses.length})
						</div>
					</div>
					{#each results.lenses as lens (lens.id)}
						<a
							href={resolve(`/lenses/${lens.id}`)}
							class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
							onclick={close}
						>
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500"
							>
								<Microscope class="h-4 w-4" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-800">
									{lens.name}
									{#if lens.brand}<span class="text-slate-500"> · {lens.brand}</span>{/if}
								</p>
								<p class="truncate text-xs text-slate-500">
									{getLensTypeLabel(lens.type)}
									{#if lens.materialName}· {lens.materialName}{/if}
								</p>
							</div>
							<span class="font-mono text-sm font-medium whitespace-nowrap text-slate-700">
								{formatPrice(lens.basePrice)}
							</span>
						</a>
					{/each}
				{/if}
			{:else if results && totalResults === 0}
				<div class="py-6 text-center">
					<p class="text-sm text-slate-500">Sin resultados para "{results.query}"</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
