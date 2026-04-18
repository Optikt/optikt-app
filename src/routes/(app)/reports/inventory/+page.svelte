<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ReportHeader } from '$lib/components/reports';
	import { formatPrice, downloadCsv } from '$lib/utils';
	import { getLensTypeLabel, getInventoryModeLabel } from '$lib/shared/enums';
	import type { InventoryLensItem } from '$lib/server/db/queries/reports';

	let { data } = $props();

	let items = $state<InventoryLensItem[]>(untrack(() => data.items));

	const stockItems = $derived(items.filter((i) => i.inventoryMode === 'STOCK'));
	const onDemandItems = $derived(items.filter((i) => i.inventoryMode === 'ON_DEMAND'));
	const totalStockUnits = $derived(stockItems.reduce((acc, i) => acc + (i.stock ?? 0), 0));
	const lowStockCount = $derived(stockItems.filter((i) => (i.stock ?? 0) <= 0).length);

	function handleExportCsv() {
		const headers = [
			'Nombre',
			'Tipo',
			'Material',
			'Proveedor',
			'Modo Inventario',
			'Stock',
			'Costo por Par',
			'Precio Venta'
		];
		const rows = items.map((i) => [
			i.name,
			getLensTypeLabel(i.type),
			i.materialName ?? '-',
			i.supplierName ?? '-',
			getInventoryModeLabel(i.inventoryMode),
			i.stock != null ? String(i.stock) : '-',
			i.pairPurchasePrice.toFixed(2),
			i.salePrice != null ? i.salePrice.toFixed(2) : '-'
		]);
		downloadCsv('inventario-lentes.csv', headers, rows);
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Inventario de Lentes - Optikt</title>
</svelte:head>

<div class="p-8">
	<ReportHeader
		title="Inventario de Lentes"
		subtitle="Stock actual por ítem"
		onExportCsv={handleExportCsv}
		onPrint={handlePrint}
	/>

	<!-- Summary -->
	<div class="mb-6 grid gap-4 sm:grid-cols-4">
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Total Lentes</p>
			<p class="text-2xl font-bold text-slate-900">{items.length}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">En Inventario (STOCK)</p>
			<p class="text-2xl font-bold text-slate-900">{stockItems.length}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Unidades en Stock</p>
			<p class="text-2xl font-bold text-slate-900">{totalStockUnits}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Sin Stock</p>
			<p class="text-2xl font-bold {lowStockCount > 0 ? 'text-red-600' : 'text-slate-900'}">
				{lowStockCount}
			</p>
		</div>
	</div>

	<!-- Stock items table -->
	{#if stockItems.length > 0}
		<div class="mb-6">
			<h2 class="mb-3 text-lg font-semibold text-slate-800">Lentes en Inventario</h2>
			<div class="glass-card overflow-hidden">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
						<tr>
							<th class="px-4 py-3">Nombre</th>
							<th class="px-4 py-3">Tipo</th>
							<th class="px-4 py-3">Material</th>
							<th class="px-4 py-3">Proveedor</th>
							<th class="px-4 py-3 text-right">Stock</th>
							<th class="px-4 py-3 text-right">Costo par</th>
							<th class="px-4 py-3 text-right">Precio Venta</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each stockItems as item (item.id)}
							<tr
								class="cursor-pointer hover:bg-slate-50"
								onclick={() => goto(resolve(`/lenses/${item.id}`))}
							>
								<td class="px-4 py-3 font-medium">{item.name}</td>
								<td class="px-4 py-3">{getLensTypeLabel(item.type)}</td>
								<td class="px-4 py-3">{item.materialName ?? '-'}</td>
								<td class="px-4 py-3">{item.supplierName ?? '-'}</td>
								<td
									class="px-4 py-3 text-right font-mono {(item.stock ?? 0) <= 0
										? 'font-bold text-red-600'
										: ''}"
								>
									{item.stock ?? 0}
								</td>
								<td class="px-4 py-3 text-right font-mono">
									{formatPrice(item.pairPurchasePrice)}
								</td>
								<td class="px-4 py-3 text-right font-mono">
									{item.salePrice != null ? formatPrice(item.salePrice) : '-'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- On-demand items table -->
	{#if onDemandItems.length > 0}
		<div>
			<h2 class="mb-3 text-lg font-semibold text-slate-800">Lentes Por Demanda</h2>
			<div class="glass-card overflow-hidden">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
						<tr>
							<th class="px-4 py-3">Nombre</th>
							<th class="px-4 py-3">Tipo</th>
							<th class="px-4 py-3">Material</th>
							<th class="px-4 py-3">Proveedor</th>
							<th class="px-4 py-3 text-right">Costo par</th>
							<th class="px-4 py-3 text-right">Precio Venta</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each onDemandItems as item (item.id)}
							<tr
								class="cursor-pointer hover:bg-slate-50"
								onclick={() => goto(resolve(`/lenses/${item.id}`))}
							>
								<td class="px-4 py-3 font-medium">{item.name}</td>
								<td class="px-4 py-3">{getLensTypeLabel(item.type)}</td>
								<td class="px-4 py-3">{item.materialName ?? '-'}</td>
								<td class="px-4 py-3">{item.supplierName ?? '-'}</td>
								<td class="px-4 py-3 text-right font-mono">
									{formatPrice(item.pairPurchasePrice)}
								</td>
								<td class="px-4 py-3 text-right font-mono">
									{item.salePrice != null ? formatPrice(item.salePrice) : '-'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#if items.length === 0}
		<div class="glass-card p-8 text-center text-slate-400">
			No hay lentes registrados en el catálogo
		</div>
	{/if}
</div>
