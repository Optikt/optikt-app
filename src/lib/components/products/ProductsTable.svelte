<script lang="ts">
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyRow,
		TableBodyCell,
		Badge,
		Button,
		Spinner
	} from 'flowbite-svelte';
	import { Eye, Pencil, Trash2, AlertTriangle } from '@lucide/svelte';
	import { ProductType, PRODUCT_TYPE_LABELS } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';

	interface Props {
		products: ProductWithRelations[];
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onDelete?: (product: ProductWithRelations) => void;
	}

	let { products, loading = false, onView, onEdit, onDelete }: Props = $props();

	// Product type badge colors
	const typeColors: Record<ProductType, 'blue' | 'green' | 'purple' | 'yellow' | 'indigo'> = {
		[ProductType.FRAME]: 'blue',
		[ProductType.SUNGLASSES]: 'green',
		[ProductType.CONTACT_LENS]: 'purple',
		[ProductType.ACCESSORY]: 'yellow',
		[ProductType.LENS]: 'indigo'
	};

	function isLowStock(product: ProductWithRelations): boolean {
		if (product.stock === null || product.minStock === null) return false;
		return product.stock <= product.minStock;
	}

	function formatPrice(price: number): string {
		return new Intl.NumberFormat('es-VE', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2
		}).format(price);
	}
</script>

<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
	<Table hoverable>
		<TableHead class="bg-slate-50">
			<TableHeadCell class="font-semibold text-slate-600">SKU</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Nombre</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Tipo</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Marca</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Precio</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Stock</TableHeadCell>
			<TableHeadCell class="font-semibold text-slate-600">Estado</TableHeadCell>
			<TableHeadCell class="text-right font-semibold text-slate-600">Acciones</TableHeadCell>
		</TableHead>
		<TableBody>
			{#if loading}
				<TableBodyRow>
					<TableBodyCell colspan={8} class="py-12 text-center">
						<Spinner class="mx-auto" size="8" />
					</TableBodyCell>
				</TableBodyRow>
			{:else if products.length === 0}
				<TableBodyRow>
					<TableBodyCell colspan={8} class="py-12 text-center text-slate-500">
						No se encontraron productos
					</TableBodyCell>
				</TableBodyRow>
			{:else}
				{#each products as product (product.id)}
					<TableBodyRow class="hover:bg-slate-50/50">
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
										<AlertTriangle class="h-4 w-4" />
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
						<TableBodyCell class="text-right">
							<div class="flex justify-end gap-1">
								{#if onView}
									<Button
										size="xs"
										color="alternative"
										class="p-2"
										onclick={() => onView?.(product)}
									>
										<Eye class="h-4 w-4" />
									</Button>
								{/if}
								{#if onEdit}
									<Button
										size="xs"
										color="alternative"
										class="p-2"
										onclick={() => onEdit?.(product)}
									>
										<Pencil class="h-4 w-4" />
									</Button>
								{/if}
								{#if onDelete}
									<Button
										size="xs"
										color="alternative"
										class="p-2 text-red-600 hover:bg-red-50"
										onclick={() => onDelete?.(product)}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								{/if}
							</div>
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			{/if}
		</TableBody>
	</Table>
</div>
