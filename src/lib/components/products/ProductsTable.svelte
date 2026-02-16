<script lang="ts">
	import { TableHeadCell, TableBodyCell, Badge } from 'flowbite-svelte';
	import { Eye, Pencil, Trash2, TriangleAlert, Package } from '@lucide/svelte';
	import { ProductType, PRODUCT_TYPE_LABELS } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice } from '$lib/utils';
	import { DataTable, ActionButton } from '$lib/components/ui';

	interface Props {
		products: ProductWithRelations[];
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onDelete?: (product: ProductWithRelations) => void;
	}

	let { products, loading = false, onView, onEdit, onDelete }: Props = $props();

	// Product type badge colors
	const typeColors: Record<ProductType, 'blue' | 'green' | 'purple' | 'yellow'> = {
		[ProductType.FRAME]: 'blue',
		[ProductType.SUNGLASSES]: 'green',
		[ProductType.CONTACT_LENS]: 'purple',
		[ProductType.ACCESSORY]: 'yellow'
	};

	function isLowStock(product: ProductWithRelations): boolean {
		if (product.stock === null || product.minStock === null) return false;
		return product.stock <= product.minStock;
	}
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
				<Badge color={typeColors[product.type as ProductType]}>
					{PRODUCT_TYPE_LABELS[product.type as ProductType] || product.type}
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
			<ActionButton
				icon={Eye}
				title="Ver detalles"
				hidden={!onView}
				onclick={() => onView?.(product)}
			/>
			<ActionButton
				icon={Pencil}
				title="Editar"
				color="blue"
				hidden={!onEdit}
				onclick={() => onEdit?.(product)}
			/>
			<ActionButton
				icon={Trash2}
				title="Eliminar"
				color="red"
				hidden={!onDelete}
				onclick={() => onDelete?.(product)}
			/>
		{/snippet}
	</DataTable>
</div>
