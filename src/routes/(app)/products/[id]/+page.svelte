<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		TriangleAlert,
		History,
		Package,
		Check,
		X
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatPrice, formatDate, getProfitMargin } from '$lib/utils';
	import { untrack } from 'svelte';
	import { ConfirmModal, ProductTypeBadge, StatusBadge } from '$lib/components/ui';
	import { ChangeHistoryModal } from '$lib/components/history';
	import { deleteProductById, updateSalePriceCmd } from '$lib/remote/products.remote';
	import { getErrorMessage } from '$lib/utils';
	import { ProductType, requiresStockTracking } from '$lib/shared/enums';
	import { isLowStock } from '$lib/utils/products.js';

	let { data } = $props();
	const product = untrack(() => data.product);
	const activeLots = untrack(() => data.activeLots);
	const fifoCost = untrack(() => data.fifoCost);

	// Editable sale price
	let currentSalePrice = $state<number | null>(product.currentSalePrice);
	let editingPrice = $state(false);
	let priceInput = $state('');
	let priceSaving = $state(false);

	function startEditingPrice() {
		priceInput = currentSalePrice != null ? String(currentSalePrice) : '';
		editingPrice = true;
	}

	function cancelEditingPrice() {
		editingPrice = false;
	}

	async function savePrice() {
		const value = parseFloat(priceInput);
		if (isNaN(value) || value < 0) {
			toast.error('Precio inválido');
			return;
		}
		priceSaving = true;
		try {
			const result = await updateSalePriceCmd({ id: product.id, currentSalePrice: value });
			if (result.success) {
				currentSalePrice = value;
				editingPrice = false;
				toast.success('Precio de venta actualizado');
			} else {
				toast.error(result.error ?? 'Error actualizando precio');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error actualizando precio'));
		} finally {
			priceSaving = false;
		}
	}

	// Computed: real stock from lots (source of truth)
	const realStock = activeLots.reduce(
		(sum: number, lot: { quantityAvailable: number }) => sum + lot.quantityAvailable,
		0
	);

	// Computed: margin based on FIFO cost (next unit to sell)
	const fifoMargin = $derived(
		fifoCost != null && currentSalePrice != null
			? getProfitMargin(fifoCost, currentSalePrice)
			: null
	);

	// Margin color class
	const marginValue = $derived(
		fifoCost != null && currentSalePrice != null && fifoCost > 0
			? ((currentSalePrice - fifoCost) / fifoCost) * 100
			: null
	);

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
						<ProductTypeBadge type={product.type} />
						<StatusBadge active={product.isActive} />
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
							<dt class="text-sm text-slate-500">Costo próxima unidad</dt>
							<dd class="mt-1 font-mono text-xl font-medium text-slate-700">
								{fifoCost != null ? formatPrice(fifoCost) : '—'}
							</dd>
							{#if fifoCost != null}
								<span class="text-[10px] text-slate-400">FIFO — lote más antiguo</span>
							{/if}
						</div>
						<div class="rounded-lg bg-blue-50 p-4">
							<dt class="text-sm text-blue-600">Precio Venta</dt>
							{#if editingPrice}
								<dd class="mt-1 flex items-center gap-1">
									<input
										type="number"
										bind:value={priceInput}
										step="0.01"
										min="0"
										class="w-24 rounded border border-blue-300 bg-white px-2 py-1 font-mono text-lg font-bold text-blue-700 tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
										onkeydown={(e) => {
											if (e.key === 'Enter') savePrice();
											if (e.key === 'Escape') cancelEditingPrice();
										}}
										disabled={priceSaving}
									/>
									<button
										type="button"
										onclick={savePrice}
										disabled={priceSaving}
										class="rounded p-1 text-green-600 hover:bg-green-100 disabled:opacity-50"
									>
										<Check class="h-4 w-4" />
									</button>
									<button
										type="button"
										onclick={cancelEditingPrice}
										disabled={priceSaving}
										class="rounded p-1 text-red-500 hover:bg-red-100 disabled:opacity-50"
									>
										<X class="h-4 w-4" />
									</button>
								</dd>
							{:else}
								<dd class="mt-1 flex items-center gap-2">
									<span class="font-mono text-xl font-bold text-blue-700">
										{currentSalePrice != null ? formatPrice(currentSalePrice) : '—'}
									</span>
									<button
										type="button"
										onclick={startEditingPrice}
										class="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
										title="Editar precio de venta"
									>
										<Pencil class="h-3.5 w-3.5" />
									</button>
								</dd>
							{/if}
						</div>
						<div
							class="rounded-lg p-4"
							class:bg-green-50={marginValue != null && marginValue >= 40}
							class:bg-amber-50={marginValue != null && marginValue > 0 && marginValue < 40}
							class:bg-red-50={marginValue != null && marginValue <= 0}
							class:bg-slate-50={marginValue == null}
						>
							<dt
								class="text-sm"
								class:text-green-600={marginValue != null && marginValue >= 40}
								class:text-amber-600={marginValue != null && marginValue > 0 && marginValue < 40}
								class:text-red-600={marginValue != null && marginValue <= 0}
								class:text-slate-500={marginValue == null}
							>
								Margen próxima venta
							</dt>
							<dd
								class="mt-1 text-xl font-bold"
								class:text-green-700={marginValue != null && marginValue >= 40}
								class:text-amber-700={marginValue != null && marginValue > 0 && marginValue < 40}
								class:text-red-700={marginValue != null && marginValue <= 0}
								class:text-slate-700={marginValue == null}
							>
								{fifoMargin ?? '—'}
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
									class:text-red-600={isLowStock(product)}
									class:text-slate-900={!isLowStock(product)}
								>
									{#if isLowStock(product)}
										<span class="inline-flex items-center gap-2">
											<TriangleAlert class="h-5 w-5" />
											{realStock}
										</span>
									{:else}
										{realStock}
									{/if}
								</dd>
								<span class="text-[10px] text-slate-400"
									>{activeLots.length} lote{activeLots.length !== 1 ? 's' : ''} activo{activeLots.length !==
									1
										? 's'
										: ''}</span
								>
							</div>
							<div>
								<dt class="text-sm text-slate-500">Stock Mínimo</dt>
								<dd class="mt-1 font-medium text-slate-700">{product.minStock ?? '—'}</dd>
							</div>
							{#if isLowStock(product)}
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

		<!-- Active Lots Table (FIFO) -->
		{#if requiresStockTracking(product.type as ProductType)}
			<div class="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
				<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
					<h3 class="flex items-center gap-2 text-lg font-semibold text-slate-800">
						<Package class="h-5 w-5" />
						Lotes Activos ({activeLots.length})
					</h3>
					<div class="text-sm text-slate-500">
						Stock real: <span class="font-mono font-semibold text-slate-900">{realStock}</span>
					</div>
				</div>

				{#if activeLots.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
								<tr>
									<th class="px-6 py-3">N° Lote</th>
									<th class="px-6 py-3 text-right">Unidades disp.</th>
									<th class="px-6 py-3 text-right">Costo unitario</th>
									<th class="px-6 py-3 text-right">P. Venta lote</th>
									<th class="px-6 py-3 text-right">Fecha ingreso</th>
								</tr>
							</thead>
							<tbody>
								{#each activeLots as lot, i (lot.id)}
									<tr
										class="border-b border-slate-100 hover:bg-slate-50 {i === 0
											? 'bg-blue-50'
											: ''}"
									>
										<td class="px-6 py-3">
											<span class="font-mono font-medium"
												>LOT-{String(lot.lotNumber).padStart(4, '0')}</span
											>
											{#if i === 0}
												<span
													class="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
													>FIFO — siguiente</span
												>
											{/if}
										</td>
										<td class="px-6 py-3 text-right font-mono tabular-nums"
											>{lot.quantityAvailable}</td
										>
										<td class="px-6 py-3 text-right font-mono tabular-nums"
											>{formatPrice(lot.unitPurchasePrice)}</td
										>
										<td class="px-6 py-3 text-right font-mono tabular-nums"
											>{formatPrice(lot.unitSalePrice)}</td
										>
										<td class="px-6 py-3 text-right text-slate-500">{formatDate(lot.createdAt)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="px-6 py-8 text-center text-slate-400">
						Sin lotes activos. Crea una orden de compra para ingresar stock.
					</div>
				{/if}
			</div>
		{/if}
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
