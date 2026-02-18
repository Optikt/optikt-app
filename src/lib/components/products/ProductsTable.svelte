<script lang="ts">
	import { TableHeadCell, TableBodyCell, Badge } from 'flowbite-svelte';
	import { Eye, Trash2, TriangleAlert, Package, SquarePen } from '@lucide/svelte';
	import { getProductTypeColor, getProductTypeLabel } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice } from '$lib/utils';
	import { DataTable, ActionButton } from '$lib/components/ui';
	import { isLowStock } from '$lib/utils/products';

	interface Props {
		products: ProductWithRelations[];
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onDelete?: (product: ProductWithRelations) => void;
	}

	let { products, loading = false, onView, onEdit, onDelete }: Props = $props();
</script>

<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
	<DataTable
		items={products}
		{loading}
		emptyIcon={Package}
		emptyTitle="No se encontraron productos"
		emptyDescription="Agrega un producto para comenzar"
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
				<Badge color={getProductTypeColor(product.type)}>
					{getProductTypeLabel(product.type)}
				</Badge>
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
				{#if product.isActive}
					<Badge color="green">Activo</Badge>
				{:else}
					<Badge color="gray">Inactivo</Badge>
				{/if}
			</TableBodyCell>
		{/snippet}

		{#snippet actions(product)}
			{#if onView}
				<ActionButton icon={Eye} title="Ver detalles" onclick={() => onView(product)} />
			{/if}
			{#if onEdit}
				<ActionButton
					icon={SquarePen}
					title="Editar"
					color="blue"
					onclick={() => onEdit(product)}
				/>
			{/if}
			{#if onDelete}
				<ActionButton
					icon={Trash2}
					title="Eliminar"
					color="red"
					hidden={!onDelete}
					onclick={() => onDelete(product)}
				/>
			{/if}
		{/snippet}
	</DataTable>
</div>
