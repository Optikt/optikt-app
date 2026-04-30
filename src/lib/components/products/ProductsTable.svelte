<script lang="ts">
	import { Copy, Eye, Package, RotateCcw, SquarePen, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { copyOnLongPress } from '$lib/actions/copyOnLongPress';
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

	const columns = [
		{ key: 'product', label: 'Producto' },
		{ key: 'code', label: 'Codigo' },
		{ key: 'sku', label: 'SKU' },
		{ key: 'type', label: 'Categoría' },
		{ key: 'brand', label: 'Marca' },
		{ key: 'stock', label: 'Stock' },
		{ key: 'price', label: 'Precio', align: 'right' as const },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

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

	function stockCountClasses(product: ProductWithRelations): string {
		const variant = stockBadgeVariant(product);

		if (variant === 'error') return 'bg-error text-white';
		if (variant === 'warning') return 'bg-warning-container text-on-warning-container';
		if (variant === 'success') return 'bg-success-container text-on-success-container';
		return 'bg-surface-container-high text-on-surface-variant';
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
		console.error(error);
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
		} catch (error) {
			console.error(error);
			toast.error(`No se pudo copiar ${label.toLowerCase()}`);
		}
	}
</script>

<svelte:document onclick={handleDocumentClick} />

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

	{#snippet mobileCard(product)}
		<div class="space-y-2">
			<div class="flex items-start gap-4">
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h3 class="min-w-0 text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-brand-navy">
							{product.name}
						</h3>
						<p
							class="font-mono text-lg font-semibold tabular-nums {product.currentSalePrice != null
								? 'text-brand-navy'
								: 'text-outline'}"
						>
							{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '-'}
						</p>
					</div>

					<p class="mt-2 text-[15px] text-on-surface-variant">
						{product.brand?.name ?? product.supplier?.name ?? 'Sin referencia'}
					</p>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					{#if onView}
						<button
							type="button"
							onclick={() => onView?.(product)}
							class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 text-outline transition-colors hover:border-brand-blue/30 hover:bg-info-container hover:text-on-info-container"
							title="Ver producto"
							aria-label="Ver producto"
						>
							<Eye class="h-5 w-5" />
						</button>
					{/if}

					{#if canManage}
						<div class="relative" data-mobile-actions>
							<button
								type="button"
								onclick={(event) => toggleMobileActions(event, product.id)}
								class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 text-outline transition-colors hover:border-brand-blue/30 hover:bg-surface-container-high hover:text-brand-blue"
								title="Más acciones"
								aria-label="Más acciones"
								aria-expanded={mobileActionsOpenFor === product.id}
							>
								<span class="flex items-center justify-center gap-0.5" aria-hidden="true">
									<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
									<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
									<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
								</span>
							</button>

							{#if mobileActionsOpenFor === product.id}
								<div
									class="absolute top-full right-0 z-20 mt-2 min-w-36 overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container-lowest py-1 shadow-sm"
								>
									{#if onEdit && !product.deletedAt}
										<button
											type="button"
											onclick={() => {
												closeMobileActions();
												onEdit?.(product);
											}}
											class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
										>
											Editar
										</button>
									{/if}

									{#if product.deletedAt}
										<button
											type="button"
											onclick={() => openReactivate(product)}
											class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-success-container hover:text-on-success-container"
										>
											Reactivar
										</button>
									{:else}
										<button
											type="button"
											onclick={() => openDelete(product)}
											class="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-error transition-colors hover:bg-error-container hover:text-on-error-container"
										>
											Eliminar
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div
				class="grid grid-cols-[auto_minmax(0,0.9fr)_auto_minmax(0,1.35fr)] items-baseline gap-x-2 gap-y-1 text-[11px] text-on-surface-variant"
			>
				<span class="shrink-0 font-semibold tracking-[0.14em] text-outline uppercase">Cod.</span>
				<button
					type="button"
					use:copyOnLongPress={{
						text: product.personalCode?.trim() || undefined,
						delay: 2000,
						onCopied: () => handleLongPressCopied('Código interno'),
						onError: (error) => handleLongPressError(error, 'Código interno')
					}}
					class="min-w-0 truncate bg-transparent text-left font-mono text-[12px] font-medium text-on-surface-variant select-none"
					title="Mantén presionado para copiar el código interno"
				>
					{product.personalCode?.trim() || '-'}
				</button>

				<span class="shrink-0 font-semibold tracking-[0.14em] text-outline uppercase">SKU</span>
				<button
					type="button"
					use:copyOnLongPress={{
						text: product.sku,
						delay: 2000,
						onCopied: () => handleLongPressCopied('SKU'),
						onError: (error) => handleLongPressError(error, 'SKU')
					}}
					class="min-w-0 truncate bg-transparent text-left font-mono text-[12px] font-medium text-on-surface-variant select-none"
					title="Mantén presionado para copiar el SKU"
				>
					{product.sku}
				</button>
			</div>

			<div class="flex flex-wrap items-center gap-2 pt-1">
				<ProductTypeBadge type={product.type} class="rounded-full px-4 py-1.5 text-[11px]" />

				<AppBadge variant={stockBadgeVariant(product)} class="rounded-full px-4 py-1.5 text-[11px]">
					{stockLabel(product)}
				</AppBadge>

				<span
					class="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-mono text-sm font-bold tabular-nums {stockCountClasses(
						product
					)}"
				>
					{product.stock}
				</span>

				{#if product.deletedAt}
					<AppBadge variant="neutral" class="rounded-full px-4 py-1.5 text-[11px]">
						Inactivo
					</AppBadge>
				{/if}
			</div>
		</div>
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
				<div class="flex items-center gap-2">
					<span class="font-mono text-sm text-on-surface-variant">
						{product.personalCode?.trim() || '-'}
					</span>
					{#if product.personalCode?.trim()}
						<button
							type="button"
							onclick={(event) => void copyValue(event, product.personalCode, 'Código interno')}
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
						onclick={(event) => void copyValue(event, product.sku, 'SKU')}
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
			<td class="px-4 py-4 text-right font-mono text-sm font-bold text-brand-navy">
				{product.currentSalePrice != null ? formatPrice(product.currentSalePrice) : '-'}
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

					{#if canManage && onEdit && !product.deletedAt}
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

					{#if canManage && product.deletedAt}
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
					{:else if canManage}
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
