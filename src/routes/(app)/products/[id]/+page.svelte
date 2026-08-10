<script lang="ts">
	import { ChevronRight, ClipboardList, Pencil, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { AppBadge, ConfirmModal, StatusBadge } from '$lib/components/ui';
	import { deleteProductById } from '$lib/remote/products.remote';
	import { getErrorMessage, getBackUrl, peekBackUrl } from '$lib/utils';
	import {
		getProductTypeLabel,
		isAdminRole,
		ProductType,
		requiresStockTracking
	} from '$lib/shared/enums';
	import ProductEconomyCard from '$lib/components/products/detail/ProductEconomyCard.svelte';
	import ProductIdentityCard from '$lib/components/products/detail/ProductIdentityCard.svelte';
	import ProductIncludedAccessoriesCard from '$lib/components/products/detail/ProductIncludedAccessoriesCard.svelte';
	import ProductLotsCard from '$lib/components/products/detail/ProductLotsCard.svelte';
	import ProductMovementFeed from '$lib/components/products/detail/ProductMovementFeed.svelte';
	import { getInventoryValuation, getStockHealth } from '$lib/components/products/detail/helpers';

	let { data } = $props();
	const product = untrack(() => data.product);
	const activeLots = untrack(() => data.activeLots);
	const fifoCost = untrack(() => data.fifoCost);
	const productMovements = untrack(() => data.productMovements);
	const productMovementsCount = untrack(() => data.productMovementsCount);

	const realStock = $derived(activeLots.reduce((sum, lot) => sum + lot.quantityAvailable, 0));
	const inventoryValuation = $derived(getInventoryValuation(activeLots));
	const stockHealth = $derived(getStockHealth(realStock, product.minStock));
	const stockTracked = $derived(requiresStockTracking(product.type as ProductType));
	const supportsIncludedAccessories = $derived(
		product.type === ProductType.FRAME || product.type === ProductType.SUNGLASSES
	);
	const isAdmin = $derived(isAdminRole(data.user.role));

	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let confirmInput = $state('');
	let showHistoryModal = $state(false);

	const backHref = peekBackUrl('/products');

	const relatedNames = $derived({
		...(product.brand ? { [product.brand.id]: product.brand.name } : {}),
		...(product.supplier ? { [product.supplier.id]: product.supplier.name } : {}),
		...(product.material ? { [product.material.id]: product.material.name } : {})
	});

	function openDeleteModal() {
		confirmInput = '';
		showDeleteModal = true;
	}

	function requireSkuConfirmation(): boolean {
		if (confirmInput !== product.sku) {
			toast.error(`Escriba ${product.sku} para confirmar`);
			return false;
		}

		return true;
	}

	async function confirmDelete() {
		deleteLoading = true;
		try {
			await deleteProductById({ id: product.id });
			toast.success('Producto eliminado correctamente');
			goto(resolve(getBackUrl('/products') as '/products'));
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando producto'));
		} finally {
			deleteLoading = false;
			showDeleteModal = false;
		}
	}
</script>

<svelte:head>
	<title>{product.name} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-surface px-6 py-8 xl:px-8">
	<div class="mx-auto max-w-7xl space-y-8">
		<section class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="space-y-3">
				<nav
					class="flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.18em] text-outline uppercase"
				>
					<a href={resolve(backHref as '/products')} class="transition-colors hover:text-brand-blue"
						>Inventario</a
					>
					<ChevronRight class="h-3.5 w-3.5" />
					<span class="text-brand-blue">{getProductTypeLabel(product.type)}</span>
				</nav>

				<div class="flex flex-wrap items-center gap-3">
					<h1 class="font-heading text-4xl font-extrabold tracking-[-0.04em] text-brand-navy">
						{product.name}
					</h1>
					<StatusBadge active={product.isActive} />
					{#if !product.isTaxable}
						<AppBadge variant="neutral">Exento</AppBadge>
					{/if}
				</div>

				<p class="font-mono text-sm tracking-[0.18em] text-on-surface-variant uppercase">
					SKU: {product.sku}
				</p>
			</div>

			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					onclick={() => (showHistoryModal = true)}
					class="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
				>
					<ClipboardList class="h-4 w-4" />
					Cambios
				</button>
				{#if isAdmin}
					<a
						href={resolve(`/products/${product.id}/update`)}
						class="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
					>
						<Pencil class="h-4 w-4" />
						Editar
					</a>
					<button
						type="button"
						onclick={openDeleteModal}
						class="inline-flex items-center gap-2 rounded-lg bg-error-container px-5 py-3 text-sm font-semibold text-on-error-container transition-opacity hover:opacity-90"
					>
						<Trash2 class="h-4 w-4" />
						Eliminar
					</button>
				{/if}
			</div>
		</section>

		<div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
			<div class="xl:col-span-8">
				<ProductIdentityCard
					{product}
					{realStock}
					activeLotsCount={activeLots.length}
					{stockHealth}
				/>
			</div>
			<div class="xl:col-span-4">
				<ProductEconomyCard
					productId={product.id}
					salePrice={product.currentSalePrice}
					{fifoCost}
					{inventoryValuation}
					editable={isAdmin}
				/>
			</div>
		</div>

		{#if supportsIncludedAccessories}
			<ProductIncludedAccessoriesCard
				{product}
				canManage={isAdmin}
				initialBrandAccessories={data.brandAccessories}
				initialProductOverride={data.productAccessoryOverride}
			/>
		{/if}

		{#if stockTracked}
			<div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
				<div class="xl:col-span-7">
					<ProductLotsCard
						{activeLots}
						productId={product.id}
						{realStock}
						canManageInventory={isAdmin}
					/>
				</div>
				<div class="xl:col-span-5">
					<ProductMovementFeed
						movements={productMovements}
						total={productMovementsCount}
						productId={product.id}
						canManageInventory={isAdmin}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Producto"
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={confirmDelete}
	shouldConfirm={requireSkuConfirmation}
	onCancel={() => {
		showDeleteModal = false;
		confirmInput = '';
	}}
>
	{#snippet body()}
		<div class="space-y-4">
			<p class="text-sm text-gray-700">
				Esto eliminara el producto <strong>{product.name}</strong>. Para confirmar, escriba el SKU
				<strong>{product.sku}</strong>.
			</p>
			<div>
				<label
					for="confirmProductSku"
					class="mb-2 block text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
				>
					Confirmacion por SKU
				</label>
				<input
					id="confirmProductSku"
					bind:value={confirmInput}
					placeholder="Escriba el SKU del producto"
					class="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none"
				/>
			</div>
		</div>
	{/snippet}
</ConfirmModal>

<ChangeHistoryModal
	bind:open={showHistoryModal}
	title={product.name}
	entityType="product"
	entityId={product.id}
	{relatedNames}
/>
