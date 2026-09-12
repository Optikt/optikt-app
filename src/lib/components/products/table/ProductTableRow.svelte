<script lang="ts">
	import { Copy, Eye, RotateCcw, SquarePen, Trash2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { AppBadge, ProductTypeBadge } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import { stockBadgeVariant, stockLabel } from './productTableDisplay';

	type ProductViewHref = `/products/${string}`;
	type ProductEditHref = `/products/${string}/update`;

	interface Props {
		product: ProductWithRelations;
		viewHref?: ProductViewHref;
		editHref?: ProductEditHref;
		canManage: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onDelete: (product: ProductWithRelations) => void;
		onReactivate: (product: ProductWithRelations) => void;
		onCopy: (event: MouseEvent, value: string | null | undefined, label: string) => void;
	}

	let {
		product,
		viewHref,
		editHref,
		canManage,
		onView,
		onEdit,
		onDelete,
		onReactivate,
		onCopy
	}: Props = $props();
</script>

<tr
	class="bg-surface-container-lowest transition-colors {onView
		? 'cursor-pointer hover:bg-surface-container-low'
		: ''}"
	onclick={() => onView?.(product)}
>
	<td class="px-4 py-4">
		<div class="min-w-[16rem]">
			<p class="font-medium text-on-surface">{product.name}</p>
			<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-outline">
				<span>{product.supplier?.name ?? 'Sin proveedor'}</span>
				{#if product.deletedAt}
					<AppBadge variant="neutral">Inactivo</AppBadge>
				{/if}
			</div>
		</div>
	</td>
	<td class="px-4 py-4">
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm text-on-surface-variant">
				{product.personalCode?.trim() || '-'}
			</span>
			{#if product.personalCode?.trim()}
				<button
					type="button"
					onclick={(event) => onCopy(event, product.personalCode, 'Código interno')}
					class="rounded p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-brand-blue"
					title="Copiar código interno"
				>
					<Copy class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</td>
	<td class="px-4 py-4">
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm text-on-surface-variant">{product.sku}</span>
			<button
				type="button"
				onclick={(event) => onCopy(event, product.sku, 'SKU')}
				class="rounded p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-brand-blue"
				title="Copiar SKU"
			>
				<Copy class="h-3.5 w-3.5" />
			</button>
		</div>
	</td>
	<td class="px-4 py-4">
		<ProductTypeBadge type={product.type} />
	</td>
	<td class="px-4 py-4 text-sm text-on-surface-variant">
		{product.brand?.name ?? '-'}
	</td>
	<td class="px-4 py-4">
		<div class="flex items-center gap-2">
			<AppBadge variant={stockBadgeVariant(product)}>{stockLabel(product)}</AppBadge>
			<span class="font-mono text-sm font-semibold text-brand-navy">{product.stock}</span>
		</div>
	</td>
	<td class="px-4 py-4">
		<div class="flex flex-col items-end justify-center">
			<span class="font-mono text-sm font-bold text-brand-navy">
				{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '-'} -
			</span>
			{#if product.currentPurchasePrice != null}
				<span class="text-xs text-slate-500">
					Costo: {formatPrice(product.currentPurchasePrice)}
				</span>
			{/if}
		</div>
	</td>
	<td class="px-4 py-4 text-right">
		<div class="flex items-center justify-end gap-1">
			{#if viewHref}
				<a
					href={resolve(viewHref)}
					onclick={(event) => event.stopPropagation()}
					class="rounded-md bg-info-container px-3 py-1.5 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver producto"
				>
					<span class="inline-flex items-center gap-1.5">
						<Eye class="h-3.5 w-3.5" />
						Ver
					</span>
				</a>
			{:else if onView}
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onView?.(product);
					}}
					class="rounded-md bg-info-container px-3 py-1.5 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver producto"
				>
					<span class="inline-flex items-center gap-1.5">
						<Eye class="h-3.5 w-3.5" />
						Ver
					</span>
				</button>
			{/if}

			{#if canManage && !product.deletedAt}
				{#if editHref}
					<a
						href={resolve(editHref)}
						onclick={(event) => event.stopPropagation()}
						class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
						title="Editar producto"
						aria-label="Editar producto"
					>
						<SquarePen class="h-4 w-4" />
					</a>
				{:else if onEdit}
					<button
						type="button"
						onclick={(event) => {
							event.stopPropagation();
							onEdit?.(product);
						}}
						class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
						title="Editar producto"
					>
						<SquarePen class="h-4 w-4" />
					</button>
				{/if}
			{/if}

			{#if canManage && product.deletedAt}
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onReactivate(product);
					}}
					class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-success-container hover:text-on-success-container"
					title="Reactivar producto"
				>
					<RotateCcw class="h-4 w-4" />
				</button>
			{:else if canManage}
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onDelete(product);
					}}
					class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
					title="Eliminar producto"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</td>
</tr>
