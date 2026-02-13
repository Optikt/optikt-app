<script lang="ts">
	import { Modal, Badge } from 'flowbite-svelte';
	import { ProductType, PRODUCT_TYPE_LABELS, requiresStockTracking } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice, formatDate } from '$lib/utils';

	interface Props {
		open: boolean;
		product: ProductWithRelations | null;
	}

	let { open = $bindable(), product }: Props = $props();

	// Product type badge colors
	const typeColors: Record<ProductType, 'blue' | 'green' | 'purple' | 'yellow'> = {
		[ProductType.FRAME]: 'blue',
		[ProductType.SUNGLASSES]: 'green',
		[ProductType.CONTACT_LENS]: 'purple',
		[ProductType.ACCESSORY]: 'yellow'
	};

	function getProfitMargin(purchase: number, sale: number): string {
		if (purchase === 0) return '0.0%';
		return (((sale - purchase) / purchase) * 100).toFixed(1) + '%';
	}

	function isLowStock(prod: ProductWithRelations): boolean {
		if (prod.stock === null || prod.minStock === null) return false;
		return prod.stock <= prod.minStock;
	}
</script>

<Modal bind:open size="md" title="Detalle del Producto" outsideclose>
	{#if product}
		<div class="space-y-4">
			<!-- Header with SKU and Status -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-slate-500">SKU</p>
					<p class="font-mono text-lg font-medium text-slate-900">{product.sku}</p>
				</div>
				<div class="flex gap-2">
					<Badge color={typeColors[product.type as ProductType]}>
						{PRODUCT_TYPE_LABELS[product.type as ProductType] || product.type}
					</Badge>
					{#if product.isActive}
						<Badge color="green">Activo</Badge>
					{:else}
						<Badge color="gray">Inactivo</Badge>
					{/if}
				</div>
			</div>

			<!-- Name -->
			<div>
				<p class="text-sm text-slate-500">Nombre</p>
				<p class="text-lg font-medium text-slate-900">{product.name}</p>
			</div>

			<!-- Brand & Supplier -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<p class="text-sm text-slate-500">Marca</p>
					<p class="font-medium text-slate-700">{product.brand?.name || '—'}</p>
				</div>
				<div>
					<p class="text-sm text-slate-500">Proveedor</p>
					<p class="font-medium text-slate-700">{product.supplier?.name || '—'}</p>
				</div>
			</div>

			<!-- Color & Size -->
			{#if product.color || product.size}
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-slate-500">Color</p>
						<p class="font-medium text-slate-700">{product.color || '—'}</p>
					</div>
					<div>
						<p class="text-sm text-slate-500">Tamaño</p>
						<p class="font-medium text-slate-700">{product.size || '—'}</p>
					</div>
				</div>
			{/if}

			<!-- Pricing -->
			<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
				<p class="mb-2 text-sm font-medium text-slate-600">Precios</p>
				<div class="grid grid-cols-3 gap-4">
					<div>
						<p class="text-sm text-slate-500">Compra</p>
						<p class="font-mono text-lg font-medium text-slate-700">
							{formatPrice(product.purchasePrice)}
						</p>
					</div>
					<div>
						<p class="text-sm text-slate-500">Venta</p>
						<p class="font-mono text-lg font-medium text-slate-900">
							{formatPrice(product.salePrice)}
						</p>
					</div>
					<div>
						<p class="text-sm text-slate-500">Margen</p>
						<p class="text-lg font-medium text-green-600">
							{getProfitMargin(product.purchasePrice, product.salePrice)}
						</p>
					</div>
				</div>
			</div>

			<!-- Stock (if applicable) -->
			{#if requiresStockTracking(product.type as ProductType) || product.stock !== null}
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-slate-500">Stock actual</p>
						<p
							class="text-lg font-medium"
							class:text-red-600={isLowStock(product)}
							class:text-slate-700={!isLowStock(product)}
						>
							{product.stock ?? '—'}
							{#if isLowStock(product)}
								<span class="text-sm">(Bajo)</span>
							{/if}
						</p>
					</div>
					<div>
						<p class="text-sm text-slate-500">Stock mínimo</p>
						<p class="text-lg font-medium text-slate-700">{product.minStock ?? '—'}</p>
					</div>
				</div>
			{/if}

			<!-- Description -->
			{#if product.description}
				<div>
					<p class="text-sm text-slate-500">Descripción</p>
					<p class="text-slate-700">{product.description}</p>
				</div>
			{/if}

			<!-- Metadata -->
			<div class="border-t border-slate-200 pt-4">
				<div class="grid grid-cols-2 gap-4 text-sm text-slate-500">
					<div>
						<span>Creado:</span>
						<span class="ml-1">{formatDate(product.createdAt)}</span>
					</div>
					<div>
						<span>Actualizado:</span>
						<span class="ml-1">{formatDate(product.updatedAt)}</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</Modal>
