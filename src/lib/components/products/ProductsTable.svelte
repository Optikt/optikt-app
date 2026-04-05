<script lang="ts">
	import {
		TableHeadCell,
		TableBodyCell,
		Modal,
		Button,
		Input,
		Label,
		Spinner
	} from 'flowbite-svelte';
	import { TriangleAlert, Package, Eye, SquarePen, Trash2, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice } from '$lib/utils';
	import { DataTable, ProductTypeBadge, StatusBadge } from '$lib/components/ui';
	import { isLowStock } from '$lib/utils/products';
	import { deleteProductById } from '$lib/remote/products.remote';
	import { getErrorMessage } from '$lib/utils';
	import ProductReactivateModal from './ProductReactivateModal.svelte';

	interface Props {
		products: ProductWithRelations[];
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		onRefresh?: () => void;
	}

	let { products, loading = false, onView, onEdit, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedProduct = $state<ProductWithRelations | null>(null);
	let deleteLoading = $state(false);
	let confirmInput = $state('');

	// For safety, user must type product SKU to confirm
	const canConfirm = $derived(confirmInput === selectedProduct?.sku);

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
		if (!selectedProduct || !canConfirm) return;

		deleteLoading = true;
		try {
			await deleteProductById({ id: selectedProduct.id });
			toast.success('Producto eliminado exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando producto'));
		} finally {
			deleteLoading = false;
		}
	}

	function closeModal() {
		showDeleteModal = false;
		selectedProduct = null;
		confirmInput = '';
	}
</script>

<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
	<DataTable
		items={products}
		{loading}
		emptyIcon={Package}
		emptyTitle="No se encontraron productos"
		emptyDescription="Agrega un producto para comenzar"
		defaultActions="view,edit,delete,reactivate"
		{onView}
		{onEdit}
		onDelete={openDelete}
		onReactivate={openReactivate}
		viewIcon={Eye}
		editIcon={SquarePen}
		deleteIcon={Trash2}
		reactivateIcon={RotateCcw}
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
				{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '—'}
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
				<StatusBadge active={!product.deletedAt} />
			</TableBodyCell>
		{/snippet}
	</DataTable>
</div>

<!-- Delete Confirm Modal -->
<Modal bind:open={showDeleteModal} title="Eliminar Producto" size="sm">
	<div class="flex flex-col gap-4">
		<p class="text-slate-600">
			¿Está seguro que desea eliminar el producto <strong>{selectedProduct?.sku}</strong> (
			{selectedProduct?.name})?
		</p>

		<!-- Confirmation input -->
		<div>
			<Label for="confirmSku" class="mb-2">
				Escriba <strong class="text-red-600">{selectedProduct?.sku}</strong> para confirmar:
			</Label>
			<Input
				id="confirmSku"
				bind:value={confirmInput}
				placeholder="Escriba el SKU del producto"
				class="placeholder:text-slate-400"
			/>
		</div>
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={closeModal}>Cancelar</Button>
		<Button color="red" disabled={!canConfirm || deleteLoading} onclick={handleDelete}>
			{#if deleteLoading}<Spinner size="4" class="mr-2" />{/if}
			Eliminar
		</Button>
	</div>
</Modal>

<!-- Reactivate Modal -->
<ProductReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedProduct}
	onSuccess={() => {
		selectedProduct = null;
		onRefresh?.();
	}}
/>
