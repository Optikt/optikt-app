<script lang="ts">
	import { Badge, Button } from 'flowbite-svelte';
	import { ArrowLeft, Pencil, Trash2, TriangleAlert, History } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatPrice, formatDate } from '$lib/utils';
	import { untrack } from 'svelte';
	import { ConfirmModal } from '$lib/components/ui';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { deleteProductById } from '$lib/remote/products.remote';
	import { getErrorMessage } from '$lib/utils';
	import { ProductType, PRODUCT_TYPE_LABELS, requiresStockTracking } from '$lib/shared/enums';

	let { data } = $props();
	const product = untrack(() => data.product);

	// Delete modal state
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);

	// History modal state
	let showHistoryModal = $state(false);

	// Build related names map for displaying references
	const relatedNames = $derived({
		...(product.brand ? { [product.brand.id]: product.brand.name } : {}),
		...(product.supplier ? { [product.supplier.id]: product.supplier.name } : {}),
		...(product.material ? { [product.material.id]: product.material.name } : {})
	});

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

	function isLowStock(): boolean {
		if (product.stock === null || product.minStock === null) return false;
		return product.stock <= product.minStock;
	}

	async function confirmDelete() {
		deleteLoading = true;
		try {
			await deleteProductById({ id: product.id });
			toast.success('Producto eliminado correctamente');
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/products');
		} catch (e) {
			console.error(e);
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

<div class="min-h-screen bg-slate-50/50 p-8">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-8">
			<a
				href={resolve('/products')}
				class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
			>
				<ArrowLeft class="h-4 w-4" />
				Volver a productos
			</a>

			<div class="flex items-start justify-between">
				<div>
					<div class="flex items-center gap-3">
						<h1 class="text-3xl font-bold tracking-tight text-slate-900">{product.name}</h1>
						<Badge color={typeColors[product.type as ProductType]}>
							{PRODUCT_TYPE_LABELS[product.type as ProductType] || product.type}
						</Badge>
						{#if product.isActive}
							<Badge color="green">Activo</Badge>
						{:else}
							<Badge color="gray">Inactivo</Badge>
						{/if}
					</div>
					<p class="mt-1 font-mono text-slate-500">{product.sku}</p>
				</div>

				<div class="flex gap-2">
					<Button color="light" onclick={() => (showHistoryModal = true)}>
						<History class="mr-2 h-4 w-4" />
						Historial
					</Button>
					<Button color="alternative" href={`/products/${product.id}/update`}>
						<Pencil class="mr-2 h-4 w-4" />
						Editar
					</Button>
					<Button color="red" outline onclick={() => (showDeleteModal = true)}>
						<Trash2 class="mr-2 h-4 w-4" />
						Eliminar
					</Button>
				</div>
			</div>
		</div>

		<!-- Content Grid -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Main Info -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Basic Info Card -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Información General</h3>
					<dl class="grid gap-4 sm:grid-cols-2">
						<div>
							<dt class="text-sm text-slate-500">Marca</dt>
							<dd class="font-medium text-slate-700">{product.brand?.name || '—'}</dd>
						</div>
						<div>
							<dt class="text-sm text-slate-500">Proveedor</dt>
							<dd class="font-medium text-slate-700">{product.supplier?.name || '—'}</dd>
						</div>
						<div>
							<dt class="text-sm text-slate-500">Color</dt>
							<dd class="font-medium text-slate-700">{product.color || '—'}</dd>
						</div>
						<div>
							<dt class="text-sm text-slate-500">Tamaño</dt>
							<dd class="font-medium text-slate-700">{product.size || '—'}</dd>
						</div>
					</dl>
					{#if product.description}
						<div class="mt-4 border-t border-slate-100 pt-4">
							<dt class="text-sm text-slate-500">Descripción</dt>
							<dd class="mt-1 text-slate-700">{product.description}</dd>
						</div>
					{/if}
				</div>

				<!-- Pricing Card -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Precios</h3>
					<div class="grid gap-4 sm:grid-cols-3">
						<div class="rounded-lg bg-slate-50 p-4">
							<dt class="text-sm text-slate-500">Precio Compra</dt>
							<dd class="mt-1 font-mono text-xl font-medium text-slate-700">
								{formatPrice(product.purchasePrice)}
							</dd>
						</div>
						<div class="rounded-lg bg-blue-50 p-4">
							<dt class="text-sm text-blue-600">Precio Venta</dt>
							<dd class="mt-1 font-mono text-xl font-bold text-blue-700">
								{formatPrice(product.salePrice)}
							</dd>
						</div>
						<div class="rounded-lg bg-green-50 p-4">
							<dt class="text-sm text-green-600">Margen</dt>
							<dd class="mt-1 text-xl font-bold text-green-700">
								{getProfitMargin(product.purchasePrice, product.salePrice)}
							</dd>
						</div>
					</div>
				</div>
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Stock Card -->
				{#if requiresStockTracking(product.type as ProductType) || product.stock !== null}
					<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 class="mb-4 text-lg font-semibold text-slate-800">Inventario</h3>
						<div class="space-y-4">
							<div>
								<dt class="text-sm text-slate-500">Stock Actual</dt>
								<dd
									class="mt-1 text-2xl font-bold"
									class:text-red-600={isLowStock()}
									class:text-slate-900={!isLowStock()}
								>
									{#if isLowStock()}
										<span class="inline-flex items-center gap-2">
											<TriangleAlert class="h-5 w-5" />
											{product.stock}
										</span>
									{:else}
										{product.stock ?? '—'}
									{/if}
								</dd>
							</div>
							<div>
								<dt class="text-sm text-slate-500">Stock Mínimo</dt>
								<dd class="mt-1 font-medium text-slate-700">{product.minStock ?? '—'}</dd>
							</div>
							{#if isLowStock()}
								<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
									⚠️ Stock bajo nivel mínimo. Considerar reposición.
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Metadata Card -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">Información del Sistema</h3>
					<dl class="space-y-3 text-sm">
						<div>
							<dt class="text-slate-500">ID</dt>
							<dd class="font-mono text-xs text-slate-600">{product.id}</dd>
						</div>
						<div>
							<dt class="text-slate-500">Creado</dt>
							<dd class="text-slate-700">{formatDate(product.createdAt)}</dd>
						</div>
						<div>
							<dt class="text-slate-500">Actualizado</dt>
							<dd class="text-slate-700">{formatDate(product.updatedAt)}</dd>
						</div>
					</dl>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Producto"
	message="¿Estás seguro de que deseas eliminar este producto? Esta acción puede ser revertida."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={confirmDelete}
	onCancel={() => (showDeleteModal = false)}
/>

<!-- History Modal -->
<ChangeHistoryModal
	bind:open={showHistoryModal}
	title={product.name}
	entityType="product"
	entityId={product.id}
	{relatedNames}
/>
