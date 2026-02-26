<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { TriangleAlert, Package, Eye, SquarePen, Trash2 } from '@lucide/svelte';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice } from '$lib/utils';
	import { DataTable, ProductTypeBadge, StatusBadge } from '$lib/components/ui';
	import { isLowStock } from '$lib/utils/products';

	interface Props {
		products: ProductWithRelations[];
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onDelete?: (product: ProductWithRelations) => void;
		refetch?: () => void | Promise<void>;
	}

	let { products, loading = false, onView, onEdit, onDelete, refetch }: Props = $props();
</script>

<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
	<DataTable
		items={products}
		{loading}
		{refetch}
		emptyIcon={Package}
		emptyTitle="No se encontraron productos"
		emptyDescription="Agrega un producto para comenzar"
		defaultActions="view,edit,delete"
		{onView}
		{onEdit}
		{onDelete}
		viewIcon={Eye}
		editIcon={SquarePen}
		deleteIcon={Trash2}
	>
		{#snippet header()}
			<TableHeadCell class="font-semibold text-slate-600">SKU</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Nombre</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Tipo</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Marca</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Precio</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Stock</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Estado</TableHeadCell>
		{/snippet}

		{#snippet row(product)}
			<TableBodyCell class="font-mono text-sm text-slate-700">{product.sku}</TableBodyCell>
			<TableBodyCell class="font-medium text-slate-900">{product.name}</TableBodyCell>
			<TableBodyCell>
				<ProductTypeBadge type={product.type} />
			</TableBodyCell>
			<TableBodyCell class="text-slate-600">
				{product.brand?.name || '—'}
			</TableBodyCell>
			<TableBodyCell class="font-mono text-slate-700">
				{formatPrice(product.salePrice)}
			</TableBodyCell>
			<TableBodyCell>
				{#if product.stock !== null}
					<span
						class="inline-flex items-center gap-1 font-mono"
						class:text-red-600={isLowStock(product)}
						class:text-slate-700={!isLowStock(product)}
					>
						{#if isLowStock(product)}
							<TriangleAlert class="h-4 w-4" />
						{/if}
						{product.stock}
					</span>
				{:else}
					<span class="text-slate-400">—</span>
				{/if}
			</TableBodyCell>
			<TableBodyCell>
				<StatusBadge active={product.isActive} />
			</TableBodyCell>
		{/snippet}
	</DataTable>
</div>
