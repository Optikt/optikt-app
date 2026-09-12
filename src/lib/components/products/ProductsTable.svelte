<script lang="ts">
	import { Package } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { deleteProductById } from '$lib/remote/products.remote';
	import { ConfirmModal, DataGrid } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import ProductReactivateModal from './ProductReactivateModal.svelte';
	import ProductTableMobileCard from './table/ProductTableMobileCard.svelte';
	import ProductTableRow from './table/ProductTableRow.svelte';
	import { productTableColumns } from './table/productTableDisplay';

	type ProductViewHref = `/products/${string}`;
	type ProductEditHref = `/products/${string}/update`;

	interface Props {
		products: ProductWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onView?: (product: ProductWithRelations) => void;
		onEdit?: (product: ProductWithRelations) => void;
		getViewHref?: (product: ProductWithRelations) => ProductViewHref;
		getEditHref?: (product: ProductWithRelations) => ProductEditHref;
		canManage?: boolean;
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
		getViewHref,
		getEditHref,
		canManage = true,
		onRefresh,
		onPageChange
	}: Props = $props();

	let showDeleteModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedProduct = $state<ProductWithRelations | null>(null);
	let deleteLoading = $state(false);
	let confirmInput = $state('');
	let mobileActionsOpenFor = $state<string | null>(null);

	function openDelete(product: ProductWithRelations) {
		mobileActionsOpenFor = null;
		selectedProduct = product;
		confirmInput = '';
		showDeleteModal = true;
	}

	function openReactivate(product: ProductWithRelations) {
		mobileActionsOpenFor = null;
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

	function toggleMobileActions(event: MouseEvent, productId: string) {
		event.stopPropagation();
		mobileActionsOpenFor = mobileActionsOpenFor === productId ? null : productId;
	}

	function closeMobileActions() {
		mobileActionsOpenFor = null;
	}

	function handleDocumentClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-mobile-actions]')) {
			closeMobileActions();
		}
	}

	function handleLongPressCopied(label: string) {
		toast.success(`${label} copiado`);
	}

	function handleLongPressError(error: unknown, label: string) {
		toast.error(`No se pudo copiar ${label.toLowerCase()}`);
	}

	async function copyValue(
		event: MouseEvent,
		value: string | null | undefined,
		label: string
	): Promise<void> {
		event.stopPropagation();

		const text = value?.trim();
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copiado`);
		} catch {
			toast.error(`No se pudo copiar ${label.toLowerCase()}`);
		}
	}
</script>

<svelte:document onclick={handleDocumentClick} />

<DataGrid
	columns={productTableColumns}
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

	{#snippet mobileCard(product)}
		<ProductTableMobileCard
			{product}
			viewHref={getViewHref?.(product)}
			editHref={getEditHref?.(product)}
			{canManage}
			{mobileActionsOpenFor}
			{onView}
			{onEdit}
			onToggleActions={toggleMobileActions}
			onCloseActions={closeMobileActions}
			onDelete={openDelete}
			onReactivate={openReactivate}
			onLongPressCopied={handleLongPressCopied}
			onLongPressError={handleLongPressError}
		/>
	{/snippet}

	{#snippet row(product)}
		<ProductTableRow
			{product}
			viewHref={getViewHref?.(product)}
			editHref={getEditHref?.(product)}
			{canManage}
			{onView}
			{onEdit}
			onDelete={openDelete}
			onReactivate={openReactivate}
			onCopy={copyValue}
		/>
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
