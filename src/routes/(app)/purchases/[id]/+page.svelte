<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import {
		ArrowLeft,
		Truck,
		Calendar,
		Hash,
		FileText,
		CheckCircle,
		XCircle,
		Package
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PurchaseOrderStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { PriceSuggestionModal } from '$lib/components/purchases';
	import {
		confirmPurchaseOrderCmd,
		cancelPurchaseOrderCmd,
		applyPriceSuggestionsCmd
	} from '$lib/remote/purchaseOrders.remote';
	import type { PriceSuggestion } from '$lib/remote/purchaseOrders.remote';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { PurchaseOrderStatus, getPurchaseOrderItemTypeLabel } from '$lib/shared/enums';
	import type {
		PurchaseOrderWithRelations,
		PurchaseOrderItemWithProduct
	} from '$lib/server/db/queries/purchaseOrders';
	import { untrack, tick } from 'svelte';

	let { data } = $props();
	let purchaseOrder = $state<PurchaseOrderWithRelations>(untrack(() => data.purchaseOrder));
	let items = $state<PurchaseOrderItemWithProduct[]>(untrack(() => data.items));

	/** Re-sync local state from server data after invalidation */
	function syncFromData() {
		purchaseOrder = data.purchaseOrder;
		items = data.items;
	}

	let isDraft = $derived(purchaseOrder.status === PurchaseOrderStatus.DRAFT);

	let actionLoading = $state(false);
	let showConfirmModal = $state(false);
	let showCancelModal = $state(false);
	let showPriceSuggestionModal = $state(false);
	let priceSuggestions = $state<PriceSuggestion[]>([]);
	let priceLoading = $state(false);

	let totalItems = $derived(items.reduce((sum, item) => sum + item.quantity, 0));
	let totalPurchase = $derived(
		items.reduce((sum, item) => sum + item.unitPurchasePrice * item.quantity, 0)
	);
	let totalSale = $derived(
		items.reduce((sum, item) => sum + item.unitSalePrice * item.quantity, 0)
	);

	async function handleConfirm() {
		actionLoading = true;
		try {
			const result = await confirmPurchaseOrderCmd({ id: purchaseOrder.id });
			if (result.success) {
				showConfirmModal = false;
				purchaseOrder = { ...purchaseOrder, status: PurchaseOrderStatus.CONFIRMED };

				// Show price suggestion modal if there are differences
				if (result.priceSuggestions && result.priceSuggestions.length > 0) {
					priceSuggestions = result.priceSuggestions;
					// Wait for confirm modal to fully close before opening the next one
					await tick();
					showPriceSuggestionModal = true;
					toast.success('Orden confirmada. Revisa las sugerencias de precio.');
				} else {
					toast.success('Orden de compra confirmada. Inventario actualizado.');
					await invalidateAll();
					syncFromData();
				}
			} else {
				toast.error(result.error ?? 'Error confirmando la orden');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error confirmando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleApplyPrices(updates: { productId: string; newSalePrice: number }[]) {
		priceLoading = true;
		try {
			const result = await applyPriceSuggestionsCmd({ updates });
			if (result.success) {
				toast.success(`Precios actualizados: ${result.updatedCount} producto(s)`);
				showPriceSuggestionModal = false;
				priceSuggestions = [];
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error actualizando precios');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error actualizando precios'));
		} finally {
			priceLoading = false;
		}
	}

	async function handleSkipPrices() {
		showPriceSuggestionModal = false;
		priceSuggestions = [];
		await invalidateAll();
		syncFromData();
	}

	async function handleCancel() {
		actionLoading = true;
		try {
			const result = await cancelPurchaseOrderCmd({ id: purchaseOrder.id });
			if (result.success) {
				toast.success('Orden de compra cancelada');
				showCancelModal = false;
				purchaseOrder = { ...purchaseOrder, status: PurchaseOrderStatus.CANCELLED };
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error cancelando la orden');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cancelando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Orden PO-{String(purchaseOrder.orderNumber).padStart(4, '0')} - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Back + header -->
	<div class="mb-6">
		<button
			type="button"
			class="mb-4 flex cursor-pointer items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
			onclick={() => goto(resolve('/purchases'))}
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a Órdenes de Compra
		</button>

		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">
					PO-{String(purchaseOrder.orderNumber).padStart(4, '0')}
				</h1>
				<PurchaseOrderStatusBadge status={purchaseOrder.status} />
			</div>

			{#if isDraft}
				<div class="flex gap-2">
					<Button color="green" onclick={() => (showConfirmModal = true)}>
						<CheckCircle class="mr-2 h-4 w-4" /> Confirmar
					</Button>
					<Button color="red" outline onclick={() => (showCancelModal = true)}>
						<XCircle class="mr-2 h-4 w-4" /> Cancelar
					</Button>
				</div>
			{/if}
		</div>
	</div>

	<!-- PO Info Cards -->
	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
				<Truck class="h-4 w-4" /> Proveedor
			</div>
			<p class="text-lg font-semibold text-slate-900">
				{purchaseOrder.supplier?.name ?? '—'}
			</p>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
				<Calendar class="h-4 w-4" /> Fecha de Orden
			</div>
			<p class="text-lg font-semibold text-slate-900">
				{formatDate(purchaseOrder.orderDate)}
			</p>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
				<Hash class="h-4 w-4" /> N° Factura
			</div>
			<p class="font-mono text-lg font-semibold text-slate-900">
				{purchaseOrder.invoiceNumber ?? '—'}
			</p>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
				<FileText class="h-4 w-4" /> Tasa BCV
			</div>
			<p class="font-mono text-lg font-semibold text-slate-900 tabular-nums">
				{formatPrice(purchaseOrder.bcvRate)}
			</p>
		</div>
	</div>

	<!-- Additional info row -->
	{#if purchaseOrder.deliveryNoteNumber || purchaseOrder.notes}
		<div class="mb-8 rounded-xl border border-slate-200 bg-white p-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				{#if purchaseOrder.deliveryNoteNumber}
					<div>
						<span class="text-sm font-medium text-slate-500">N° Nota de Entrega</span>
						<p class="mt-1 font-mono text-sm text-slate-900">{purchaseOrder.deliveryNoteNumber}</p>
					</div>
				{/if}
				{#if purchaseOrder.notes}
					<div>
						<span class="text-sm font-medium text-slate-500">Notas</span>
						<p class="mt-1 text-sm text-slate-700">{purchaseOrder.notes}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Items Table -->
	<div class="rounded-xl border border-slate-200 bg-white">
		<div class="border-b border-slate-200 px-6 py-4">
			<h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
				<Package class="h-5 w-5" />
				Ítems ({items.length})
			</h2>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
					<tr>
						<th class="px-6 py-3">Tipo</th>
						<th class="px-6 py-3">Producto / Lente</th>
						<th class="px-6 py-3 text-right">Cantidad</th>
						<th class="px-6 py-3 text-right">Precio Compra</th>
						<th class="px-6 py-3 text-right">Precio Venta</th>
						<th class="px-6 py-3 text-right">Subtotal Compra</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						<tr class="border-b border-slate-100 hover:bg-slate-50">
							<td class="px-6 py-3">
								<span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
									{getPurchaseOrderItemTypeLabel(item.itemType)}
								</span>
							</td>
							<td class="px-6 py-3 font-medium">
								{#if item.product}
									<div>
										<span>{item.product.name}</span>
										<span class="ml-2 font-mono text-xs text-slate-400">{item.product.sku}</span>
									</div>
								{:else}
									<span class="text-slate-400">—</span>
								{/if}
							</td>
							<td class="px-6 py-3 text-right font-mono tabular-nums">{item.quantity}</td>
							<td class="px-6 py-3 text-right font-mono tabular-nums"
								>{formatPrice(item.unitPurchasePrice)}</td
							>
							<td class="px-6 py-3 text-right font-mono tabular-nums">
								{formatPrice(item.unitSalePrice)}
								{#if item.appliesIva}
									<span
										class="ml-1 text-[10px] font-medium text-emerald-600"
										title="Incluye IVA {item.ivaRate}%">IVA</span
									>
								{/if}
							</td>
							<td class="px-6 py-3 text-right font-mono font-medium tabular-nums">
								{formatPrice(item.unitPurchasePrice * item.quantity)}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-6 py-8 text-center text-slate-400">
								No hay ítems en esta orden
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Totals -->
		<div class="border-t border-slate-200 bg-slate-50 px-6 py-4">
			<div class="flex justify-end gap-8">
				<div class="text-right">
					<span class="text-sm text-slate-500">Total Unidades</span>
					<p class="font-mono text-lg font-semibold tabular-nums">{totalItems}</p>
				</div>
				<div class="text-right">
					<span class="text-sm text-slate-500">Total Compra</span>
					<p class="font-mono text-lg font-semibold text-slate-900 tabular-nums">
						{formatPrice(totalPurchase)}
					</p>
				</div>
				<div class="text-right">
					<span class="text-sm text-slate-500">Total Venta (estimado)</span>
					<p class="font-mono text-lg font-semibold text-blue-600 tabular-nums">
						{formatPrice(totalSale)}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Meta info -->
	<div class="mt-6 flex flex-wrap gap-6 text-xs text-slate-400">
		<span>Creado por: {purchaseOrder.createdBy?.fullName ?? '—'}</span>
		<span>Creado: {formatDate(purchaseOrder.createdAt)}</span>
		{#if purchaseOrder.confirmedAt}
			<span>Confirmado: {formatDate(purchaseOrder.confirmedAt)}</span>
		{/if}
	</div>
</div>

<!-- Confirm PO Modal -->
<ConfirmModal
	bind:open={showConfirmModal}
	title="Confirmar Orden de Compra"
	message="Al confirmar esta orden, se crearán los lotes de inventario y se actualizará el stock de los productos. Esta acción no se puede deshacer."
	confirmLabel="Confirmar Orden"
	confirmColor="green"
	loading={actionLoading}
	onConfirm={handleConfirm}
	onCancel={() => (showConfirmModal = false)}
/>

<!-- Cancel PO Modal -->
<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Orden de Compra"
	message="¿Estás seguro de cancelar esta orden de compra? Esta acción no se puede deshacer."
	confirmLabel="Cancelar Orden"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>

<!-- Price Suggestion Modal -->
<PriceSuggestionModal
	bind:open={showPriceSuggestionModal}
	suggestions={priceSuggestions}
	loading={priceLoading}
	onApply={handleApplyPrices}
	onSkip={handleSkipPrices}
/>
