<script lang="ts">
	import { Package, Microscope } from '@lucide/svelte';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import type { SearchResults } from '$lib/remote/search.remote';
	import { getLensTypeLabel } from '$lib/shared/enums';
	import { getProductTypeLabel } from '$lib/shared/enums/productTypes';
	import { formatPrice } from '$lib/utils';
	import { resolve } from '$app/paths';

	/**
	 * Resultados de la búsqueda universal: sección Productos + sección Laboratorio.
	 * Compartido entre el CommandSearch de escritorio (dropdown) y la búsqueda
	 * global móvil (panel bajo la barra) — no duplicar.
	 */
	interface Props {
		results: SearchResults | null;
		loading: boolean;
		/** Se llama al abrir un resultado (cierra la búsqueda). */
		onNavigate?: () => void;
		/** Clases del contenedor scrollable de resultados. */
		class?: string;
	}

	let { results, loading, onNavigate, class: className = '' }: Props = $props();

	const PRODUCT_TYPE_ICON_CLASSES: Record<string, string> = {
		FRAME: 'bg-blue-100 text-blue-600',
		SUNGLASSES: 'bg-green-100 text-green-600',
		CONTACT_LENS: 'bg-purple-100 text-purple-600',
		ACCESSORY: 'bg-yellow-100 text-yellow-600'
	};

	const totalResults = $derived((results?.products.length ?? 0) + (results?.lenses.length ?? 0));
</script>

<div class={className}>
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
				{@const ProductIcon = getProductTypeIcon(product.type)}
				{@const iconClasses =
					PRODUCT_TYPE_ICON_CLASSES[product.type] ?? 'bg-slate-100 text-slate-500'}
				<a
					href={resolve(`/products/${product.id}`)}
					class="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
					onclick={onNavigate}
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
						{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '-'}
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
					onclick={onNavigate}
				>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
						<Microscope class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-slate-800">
							{lens.name}
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
