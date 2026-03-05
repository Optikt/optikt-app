<script lang="ts">
	import BaseSelect from '$lib/components/ui/BaseSelect.svelte';
	import { TriangleAlert } from '@lucide/svelte';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { formatPrice } from '$lib/utils';
	import {
		getProductTypeLabel,
		getProductTypeIconSvg,
		getProductTypeBadgeHex
	} from '$lib/shared/enums/productTypes';

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
			productType: p.type
		}))
	);

	const lensOptions: SelectOption[] = $derived(
		lensItems.map((l) => {
			const price = l.suggestedMultiplier ? l.basePrice * l.suggestedMultiplier : l.basePrice;
			return {
				id: l.id,
				label: `${l.name}${l.brand ? ` (${l.brand})` : ''}`,
				name: l.name,
				sku: '',
				brand: l.brand ?? '',
				stock: l.stock,
				price,
				productType: ''
			};
		})
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

	/** Custom renderer for dropdown items for Svelecte — returns raw HTML */
	function renderOption(item: object, isSelection?: boolean): string {
		const opt = item as SelectOption;

		// Product type badge (only for products, not lenses)
		const typeBadgeHtml = (() => {
			if (!opt.productType) return '';
			const { bg, text } = getProductTypeBadgeHex(opt.productType);
			const icon = getProductTypeIconSvg(opt.productType, isSelection ? 11 : 12);
			const label = getProductTypeLabel(opt.productType);
			return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:${isSelection ? '0.7rem' : '0.7rem'};color:${text};background:${bg};padding:1px 7px;border-radius:4px;font-weight:500;white-space:nowrap;">${icon}${label}</span>`;
		})();

		if (isSelection) {
			// Compact display for the selected value in the input
			const stockBadge =
				opt.stock !== null && opt.stock <= 0
					? ' <span style="color:#dc2626;font-weight:600;">⚠ Sin stock</span>'
					: '';
			return `<span style="font-weight:500;">${opt.name}</span>${opt.sku ? ` <span style="font-family:monospace;color:#64748b;font-size:0.8em;">${opt.sku}</span>` : ''} ${typeBadgeHtml}${stockBadge}`;
		}

		// Rich display for dropdown options
		const stockColor =
			opt.stock === null
				? '#94a3b8'
				: opt.stock <= 0
					? '#dc2626'
					: opt.stock <= 3
						? '#d97706'
						: '#16a34a';
		const stockLabel =
			opt.stock === null
				? ''
				: opt.stock <= 0
					? '<strong>Sin stock</strong>'
					: `${opt.stock} disp.`;
		const stockBadge = stockLabel
			? `<span style="font-size:0.75rem;color:${stockColor};font-weight:500;padding:1px 6px;border-radius:9999px;background:${opt.stock !== null && opt.stock <= 0 ? '#fef2f2' : 'transparent'};">${stockLabel}</span>`
			: '';

		return `
			<div style="display:flex;flex-direction:column;gap:2px;padding:2px 0;">
				<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
					<span style="font-weight:600;color:#1e293b;">${opt.name}</span>
					${opt.brand ? `<span style="font-size:0.75rem;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:4px;">${opt.brand}</span>` : ''}
					${typeBadgeHtml}
					${stockBadge}
				</div>
				<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;">
					${opt.sku ? `<span style="font-family:monospace;color:#64748b;">${opt.sku}</span>` : ''}
					<span style="font-weight:600;color:#1e40af;">${formatPrice(opt.price)}</span>
				</div>
			</div>
		`;
	}

	function handleChange(selected: SelectOption | null) {
		const newId = selected?.id ?? '';

		if (newId && onselect) {
			if (kind === 'product') {
				const product = products.find((p) => p.id === newId);
				if (product) onselect(newId, product.salePrice);
			} else {
				const lens = lensItems.find((l) => l.id === newId);
				if (lens) {
					const price = lens.suggestedMultiplier
						? lens.basePrice * lens.suggestedMultiplier
						: lens.basePrice;
					onselect(newId, price);
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
	renderer={renderOption}
	onChange={handleChange}
>
	{#snippet footer()}
		{#if hasStockWarning}
			{#if kind === 'lens'}
				<div
					class="mt-1.5 flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-sm font-medium text-sky-700"
				>
					<TriangleAlert class="h-4 w-4 shrink-0" />
					<span>Sin stock — se pedirá al proveedor</span>
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
	{/snippet}
</BaseSelect>
