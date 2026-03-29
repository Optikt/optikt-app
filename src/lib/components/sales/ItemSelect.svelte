<script lang="ts">
	import BaseSelect from '$lib/components/ui/BaseSelect.svelte';
	import { TriangleAlert, Eye } from '@lucide/svelte';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { formatPrice } from '$lib/utils';
	import { LensCatalogSource } from '$lib/shared/enums/lensTypes';
	import { getProductTypeBadgeHex } from '$lib/shared/enums/productTypes';

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
		/** Available products */
		products?: ProductWithRelations[];
		/** Available lens catalog items */
		lensItems?: LensCatalogItemWithRelations[];
		/** Label */
		label?: string;
		/** Callback when selection changes, passes unit price */
		onselect?: (id: string, unitPrice: number) => void;
	}

	let { kind, value = '', products = [], lensItems = [], label, onselect }: Props = $props();

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
	}

	const productOptions: SelectOption[] = $derived(
		products.map((p) => ({
			id: p.id,
			label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
			name: p.name,
			sku: p.sku ?? '',
			brand: p.brand?.name ?? '',
			stock: p.stock,
			price: p.salePrice,
			productType: p.type,
			source: undefined
		}))
	);

	const lensOptions: SelectOption[] = $derived(
		lensItems.map((l) => ({
			id: l.id,
			label: l.name,
			name: l.name,
			sku: '',
			brand: '',
			stock: l.stock,
			price: l.basePrice,
			productType: '',
			source: l.source
		}))
	);

	const options = $derived(kind === 'product' ? productOptions : lensOptions);
	const placeholder = $derived(kind === 'product' ? 'Buscar producto...' : 'Buscar lente...');

	/** Currently selected item's stock (works for both products and lenses) */
	const selectedStock = $derived.by((): number | null => {
		if (!value) return null;
		if (kind === 'product') {
			const p = products.find((p) => p.id === value);
			return p?.stock ?? null;
		}
		const l = lensItems.find((l) => l.id === value);
		return l?.stock ?? null;
	});

	const hasStockWarning = $derived(selectedStock !== null && selectedStock <= 0);
	const selectedOption = $derived(options.find((opt) => opt.id === value));

	function handleChange(selected: SelectOption | null) {
		const newId = selected?.id ?? '';

		if (newId && onselect) {
			if (kind === 'product') {
				const product = products.find((p) => p.id === newId);
				if (product) onselect(newId, product.salePrice);
			} else {
				const lens = lensItems.find((l) => l.id === newId);
				if (lens) {
					onselect(newId, lens.basePrice);
				}
			}
		} else if (!newId && onselect) {
			onselect('', 0);
		}
	}
</script>

<BaseSelect
	{label}
	{placeholder}
	{options}
	{value}
	valueField="id"
	labelField="label"
	onChange={handleChange}
>
	{#snippet option(item)}
		{@const opt = item as SelectOption}
		{@const badge = getBadge(opt.productType)}
		{@const Icon = getIcon(opt)}
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
					<span class="font-semibold text-slate-800">{opt.name}</span>
					{#if opt.brand}
						<span class="text-xs text-slate-500">· {opt.brand}</span>
					{/if}
					{#if opt.stock !== null}
						{#if opt.stock <= 0}
							<span class="rounded-full bg-red-50 px-1.5 py-px text-xs font-medium text-red-600">
								<strong>Sin stock</strong>
							</span>
						{:else if opt.stock <= 3}
							<span class="text-xs font-medium text-amber-600">{opt.stock} disp.</span>
						{:else}
							<span class="text-xs font-medium text-green-600">{opt.stock} disp.</span>
						{/if}
					{/if}
				</div>
				<div class="flex items-center gap-2 text-[0.8rem]">
					{#if opt.sku}
						<span class="font-mono text-slate-500">{opt.sku}</span>
					{/if}
					<span class="font-semibold text-blue-800">{formatPrice(opt.price)}</span>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet selection(selectedOptions)}
		{@const opt = selectedOptions[0] as SelectOption}
		{@const badge = getBadge(opt.productType)}
		{@const Icon = getIcon(opt)}
		<div class="flex items-center gap-1.5">
			<div
				class="flex h-5.5 w-5.5 min-w-5.5 items-center justify-center rounded"
				style:background={badge.bg}
				style:color={badge.text}
			>
				<Icon class="h-3 w-3" />
			</div>
			<span class="font-medium">{opt.name}</span>
			{#if opt.stock !== null && opt.stock <= 0}
				<span class="font-semibold text-red-600">⚠ Sin stock</span>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		{#if hasStockWarning}
			{#if kind === 'lens'}
				{#if selectedOption?.source === LensCatalogSource.FINISHED}
					<div
						class="mt-1.5 flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600"
					>
						<TriangleAlert class="h-4 w-4 shrink-0" />
						<span>Sin stock en inventario</span>
					</div>
				{:else if selectedOption?.source === LensCatalogSource.LAB}
					<div
						class="mt-1.5 flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-sm font-medium text-sky-700"
					>
						<TriangleAlert class="h-4 w-4 shrink-0" />
						<span>Sin stock — se pedirá al laboratorio</span>
					</div>
				{:else}
					<div
						class="mt-1.5 flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-sm font-medium text-sky-700"
					>
						<TriangleAlert class="h-4 w-4 shrink-0" />
						<span>Sin stock — se pedirá al proveedor</span>
					</div>
				{/if}
			{:else}
				<div
					class="mt-1.5 flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-600"
				>
					<TriangleAlert class="h-4 w-4 shrink-0" />
					<span>Este producto no tiene stock disponible</span>
				</div>
			{/if}
		{/if}
	{/snippet}
</BaseSelect>
