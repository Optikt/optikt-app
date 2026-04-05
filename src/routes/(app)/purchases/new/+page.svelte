<script lang="ts">
	import { Button, Select, Label, Input, Textarea } from 'flowbite-svelte';
	import { ArrowLeft, Plus, Trash2, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createPurchaseOrderCmd } from '$lib/remote/purchaseOrders.remote';
	import { getErrorMessage } from '$lib/utils';
	import { PurchaseOrderItemType } from '$lib/shared/enums';

	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { untrack } from 'svelte';

	let { data } = $props();
	let { suppliers, products } = untrack(() => data);

	// Form state
	let supplierId = $state('');
	let invoiceNumber = $state('');
	let deliveryNoteNumber = $state('');
	let orderDate = $state(new Date().toISOString().slice(0, 10));
	let bcvRate = $state<number>(0);
	let notes = $state('');
	let saving = $state(false);

	interface FormItem {
		id: string;
		itemType: string;
		productId: string;
		lensCatalogItemId: string;
		quantity: number;
		unitPurchasePrice: number;
		unitSalePrice: number;
		isTaxable: boolean;
		taxRate: number;
	}

	let items = $state<FormItem[]>([createEmptyItem()]);

	function createEmptyItem(): FormItem {
		return {
			id: crypto.randomUUID(),
			itemType: PurchaseOrderItemType.PRODUCT,
			productId: '',
			lensCatalogItemId: '',
			quantity: 1,
			unitPurchasePrice: 0,
			unitSalePrice: 0,
			isTaxable: true,
			taxRate: 16
		};
	}

	function addItem() {
		items = [...items, createEmptyItem()];
	}

	function removeItem(id: string) {
		if (items.length <= 1) return;
		items = items.filter((item) => item.id !== id);
	}

	let totalPurchase = $derived(
		items.reduce((sum, item) => sum + item.unitPurchasePrice * item.quantity, 0)
	);
	let totalSale = $derived(
		items.reduce((sum, item) => sum + item.unitSalePrice * item.quantity, 0)
	);
	let totalUnits = $derived(items.reduce((sum, item) => sum + item.quantity, 0));

	let canSave = $derived(
		supplierId !== '' &&
			orderDate !== '' &&
			bcvRate > 0 &&
			items.length > 0 &&
			items.every(
				(item) =>
					item.productId !== '' &&
					item.quantity >= 1 &&
					item.unitPurchasePrice >= 0 &&
					item.unitSalePrice >= 0
			)
	);

	async function handleSave() {
		if (!canSave) return;
		saving = true;
		try {
			const result = await createPurchaseOrderCmd({
				supplierId,
				invoiceNumber: invoiceNumber || undefined,
				deliveryNoteNumber: deliveryNoteNumber || undefined,
				orderDate: new Date(orderDate).toISOString(),
				bcvRate,
				notes: notes || undefined,
				items: items.map((item) => ({
					itemType: item.itemType as PurchaseOrderItemType,
					productId: item.productId || undefined,
					lensCatalogItemId: item.lensCatalogItemId || undefined,
					quantity: item.quantity,
					unitPurchasePrice: item.unitPurchasePrice,
					unitSalePrice: item.unitSalePrice,
					appliesIva: item.isTaxable,
					ivaRate: item.taxRate
				}))
			});

			if (result.success) {
				toast.success('Orden de compra creada exitosamente');
				goto(resolve(`/purchases/${result.purchaseOrder.id}`));
			} else {
				toast.error(result.error ?? 'Error creando la orden de compra');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error creando orden de compra'));
		} finally {
			saving = false;
		}
	}

	function handleProductChange(item: FormItem) {
		if (!item.productId) return;
		const product = products.find((p: ProductWithRelations) => p.id === item.productId);
		if (product) {
			item.unitPurchasePrice = product.currentPurchasePrice ?? 0;
			item.unitSalePrice = product.currentSalePrice ?? 0;
			item.isTaxable = product.isTaxable;
			item.taxRate = product.taxRate;
		}
	}
</script>

<svelte:head><title>Nueva Orden de Compra - Optikt</title></svelte:head>

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
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Nueva Orden de Compra</h1>
		<p class="text-slate-500">Registra una compra de productos al proveedor</p>
	</div>

	<!-- PO Header Fields -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white p-6">
		<h2 class="mb-4 text-lg font-semibold text-slate-900">Datos de la Orden</h2>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			<div>
				<Label for="supplier" class="mb-1">Proveedor *</Label>
				<Select id="supplier" bind:value={supplierId} required>
					<option value="">Seleccionar proveedor...</option>
					{#each suppliers as supplier (supplier.id)}
						<option value={supplier.id}>{supplier.name}</option>
					{/each}
				</Select>
			</div>
			<div>
				<Label for="orderDate" class="mb-1">Fecha de Orden *</Label>
				<Input id="orderDate" type="date" bind:value={orderDate} required />
			</div>
			<div>
				<Label for="bcvRate" class="mb-1">Tasa BCV (Bs/USD) *</Label>
				<Input
					id="bcvRate"
					type="number"
					step="0.01"
					min="0"
					bind:value={bcvRate}
					placeholder="Ej: 36.50"
					required
				/>
			</div>
			<div>
				<Label for="invoiceNumber" class="mb-1">N° Factura</Label>
				<Input id="invoiceNumber" bind:value={invoiceNumber} placeholder="Opcional" />
			</div>
			<div>
				<Label for="deliveryNoteNumber" class="mb-1">N° Nota de Entrega</Label>
				<Input id="deliveryNoteNumber" bind:value={deliveryNoteNumber} placeholder="Opcional" />
			</div>
			<div>
				<Label for="notes" class="mb-1">Notas</Label>
				<Textarea id="notes" bind:value={notes} rows={1} placeholder="Observaciones..." />
			</div>
		</div>
	</div>

	<!-- Items Section -->
	<div class="mb-8 rounded-xl border border-slate-200 bg-white">
		<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
			<h2 class="text-lg font-semibold text-slate-900">Ítems de la Orden</h2>
			<Button size="sm" color="blue" outline onclick={addItem}>
				<Plus class="mr-1 h-4 w-4" /> Agregar Ítem
			</Button>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3">Producto</th>
						<th class="w-24 px-4 py-3 text-right">Cant.</th>
						<th class="w-36 px-4 py-3 text-right">P. Compra ($)</th>
						<th class="w-36 px-4 py-3 text-right">P. Venta ($)</th>
						<th class="w-36 px-4 py-3 text-right">Subtotal</th>
						<th class="w-12 px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						<tr class="border-b border-slate-100">
							<td class="px-4 py-2">
								<Select
									bind:value={item.productId}
									size="sm"
									onchange={() => handleProductChange(item)}
								>
									<option value="">Seleccionar producto...</option>
									{#each products as product (product.id)}
										<option value={product.id}>
											{product.sku} — {product.name}
										</option>
									{/each}
								</Select>
							</td>
							<td class="px-4 py-2">
								<Input
									type="number"
									bind:value={item.quantity}
									min={1}
									size="sm"
									class="text-right"
								/>
							</td>
							<td class="px-4 py-2">
								<Input
									type="number"
									bind:value={item.unitPurchasePrice}
									min={0}
									step="0.01"
									size="sm"
									class="text-right"
								/>
							</td>
							<td class="px-4 py-2">
								<div class="flex items-center gap-1">
									<Input
										type="number"
										bind:value={item.unitSalePrice}
										min={0}
										step="0.01"
										size="sm"
										class="text-right"
									/>
									{#if item.isTaxable}
										<span
											class="shrink-0 text-[10px] font-medium text-emerald-600"
											title="Precio incluye IVA {item.taxRate}%">IVA</span
										>
									{/if}
								</div>
							</td>
							<td class="px-4 py-2 text-right font-mono text-sm tabular-nums">
								${(item.unitPurchasePrice * item.quantity).toFixed(2)}
							</td>
							<td class="px-4 py-2 text-center">
								{#if items.length > 1}
									<button
										type="button"
										class="cursor-pointer rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
										title="Eliminar ítem"
										onclick={() => removeItem(item.id)}
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
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
					<span class="text-sm text-slate-500">Unidades</span>
					<p class="font-mono text-lg font-semibold tabular-nums">{totalUnits}</p>
				</div>
				<div class="text-right">
					<span class="text-sm text-slate-500">Total Compra</span>
					<p class="font-mono text-lg font-semibold text-slate-900 tabular-nums">
						${totalPurchase.toFixed(2)}
					</p>
				</div>
				<div class="text-right">
					<span class="text-sm text-slate-500">Total Venta (est.)</span>
					<p class="font-mono text-lg font-semibold text-blue-600 tabular-nums">
						${totalSale.toFixed(2)}
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="flex items-center justify-end gap-3">
		<Button color="alternative" onclick={() => goto(resolve('/purchases'))}>Cancelar</Button>
		<Button color="blue" disabled={!canSave || saving} onclick={handleSave}>
			{#if saving}
				Guardando...
			{:else}
				<Save class="mr-2 h-4 w-4" /> Guardar Orden (Borrador)
			{/if}
		</Button>
	</div>
</div>
