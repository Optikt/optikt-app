<script lang="ts">
	import { Eye, Package, RotateCcw, SquarePen, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { deleteProductById } from '$lib/remote/products.remote';
	import { AppBadge, ConfirmModal, DataGrid, ProductTypeBadge } from '$lib/components/ui';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { isLowStock } from '$lib/utils/products';
	import ProductReactivateModal from './ProductReactivateModal.svelte';

	interface Props {
		products: ProductWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onRefresh?: () => void;
		onPageChange: (page: number) => void;
	}

	let {
		products,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		onView,
		onEdit,
		onRefresh,
		onPageChange
	}: Props = $props();

	let showDeleteModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedProduct = $state<ProductWithRelations | null>(null);
	let deleteLoading = $state(false);
	let confirmInput = $state('');

	const columns = [
		{ key: 'product', label: 'Producto' },
		{ key: 'sku', label: 'SKU' },
		{ key: 'type', label: 'Categoría' },
		{ key: 'brand', label: 'Marca' },
		{ key: 'stock', label: 'Stock' },
		{ key: 'price', label: 'Precio', align: 'right' as const },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	function openDelete(product: ProductWithRelations) {
		selectedProduct = product;
		confirmInput = '';
		showDeleteModal = true;
	}

	function openReactivate(product: ProductWithRelations) {
		selectedProduct = product;
		showReactivateModal = true;
	}

	async function handleDelete() {
		if (!selectedProduct) return;

		deleteLoading = true;
		try {
			await deleteProductById({ id: selectedProduct.id });
			toast.success('Producto eliminado exitosamente');
			showDeleteModal = false;
			selectedProduct = null;
			confirmInput = '';
			onRefresh?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando producto'));
		} finally {
			deleteLoading = false;
		}
	}

	function requireSkuConfirmation(): boolean {
		if (!selectedProduct) return false;
		if (confirmInput !== selectedProduct.sku) {
			toast.error(`Escriba ${selectedProduct.sku} para confirmar`);
			return false;
		}

		return true;
	}

	function stockBadgeVariant(
		product: ProductWithRelations
	): 'success' | 'warning' | 'error' | 'neutral' {
		if (product.deletedAt) return 'neutral';
		if (product.stock === 0) return 'error';
		if (isLowStock(product)) return 'warning';
		return 'success';
	}

	function stockLabel(product: ProductWithRelations): string {
		if (product.deletedAt) return 'Eliminado';
		if (product.stock === 0) return 'Agotado';
		if (isLowStock(product)) return 'Stock bajo';
		return 'En stock';
	}
</script>

<DataGrid
	{columns}
	items={products}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="productos"
	emptyTitle="No se encontraron productos"
	emptySubtitle="Agrega un producto para comenzar"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<Package class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(product)}
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
				<span class="font-mono text-sm text-on-surface-variant">{product.sku}</span>
			</td>
			<td class="px-4 py-4">
				<ProductTypeBadge type={product.type} />
			</td>
			<td class="px-4 py-4 text-sm text-on-surface-variant">
				{product.brand?.name ?? '—'}
			</td>
			<td class="px-4 py-4">
				<div class="flex items-center gap-2">
					<AppBadge variant={stockBadgeVariant(product)}>{stockLabel(product)}</AppBadge>
					<span class="font-mono text-sm font-semibold text-brand-navy">{product.stock}</span>
				</div>
			</td>
			<td class="px-4 py-4 text-right font-mono text-sm font-bold text-brand-navy">
				{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '—'}
			</td>
			<td class="px-4 py-4 text-right">
				<div class="flex items-center justify-end gap-1">
					{#if onView}
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

					{#if onEdit && !product.deletedAt}
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

					{#if product.deletedAt}
						<button
							type="button"
							onclick={(event) => {
								event.stopPropagation();
								openReactivate(product);
							}}
							class="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-success-container hover:text-on-success-container"
							title="Reactivar producto"
						>
							<RotateCcw class="h-4 w-4" />
						</button>
					{:else}
						<button
							type="button"
							onclick={(event) => {
								event.stopPropagation();
								openDelete(product);
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
	{/snippet}
</DataGrid>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Producto"
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
	shouldConfirm={requireSkuConfirmation}
	onCancel={() => {
		showDeleteModal = false;
		confirmInput = '';
	}}
>
	{#snippet body()}
		<div class="space-y-4">
			<p class="text-sm text-gray-700">
				Esto eliminará el producto <strong>{selectedProduct?.name}</strong>. Para confirmar, escriba
				el SKU
				<strong>{selectedProduct?.sku}</strong>.
			</p>
			<div>
				<label
					for="confirmSku"
					class="mb-2 block text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
				>
					Confirmación por SKU
				</label>
				<input
					id="confirmSku"
					bind:value={confirmInput}
					placeholder="Escriba el SKU del producto"
					class="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none"
				/>
			</div>
		</div>
	{/snippet}
</ConfirmModal>

<ProductReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedProduct}
	onSuccess={() => {
		selectedProduct = null;
		onRefresh?.();
	}}
/>
