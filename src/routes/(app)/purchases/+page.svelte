<script lang="ts">
	import { Button, Select, Toggle } from 'flowbite-svelte';
	import { Plus, ArrowRightLeft } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TablePagination } from '$lib/components/ui';
	import { PurchaseOrdersTable } from '$lib/components/purchases';
	import { listPurchaseOrders } from '$lib/remote/purchaseOrders.remote';
	import { getErrorMessage } from '$lib/utils';
	import {
		ALL_PURCHASE_ORDER_STATUSES,
		PURCHASE_ORDER_STATUS_LABELS,
		type PurchaseOrderStatus
	} from '$lib/shared/enums';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	let { data } = $props();
	let { initialPurchaseOrders, totalCount, suppliers } = untrack(() => data);

	let purchaseOrdersData = $state<PaginatedResult<PurchaseOrderWithRelations>>({
		items: initialPurchaseOrders,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	let statusFilter = $state<PurchaseOrderStatus | ''>('');
	let supplierFilter = $state('');
	let includeDeleted = $state(false);

	async function fetchPurchaseOrders(page = 1) {
		loading = true;
		try {
			purchaseOrdersData = await listPurchaseOrders({
				page,
				perPage: 10,
				status: statusFilter || undefined,
				supplierId: supplierFilter || undefined,
				includeDeleted
			});
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando órdenes de compra'));
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		fetchPurchaseOrders(1);
	}

	function openCreate() {
		goto(resolve('/purchases/new'));
	}
</script>

<svelte:head><title>Órdenes de Compra - Optikt</title></svelte:head>

<div class="p-8">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Órdenes de Compra</h1>
			<p class="text-slate-500">Gestiona las compras e ingreso de inventario</p>
		</div>
		<Button color="blue" onclick={openCreate}>
			<Plus class="mr-2 h-5 w-5" /> Nueva Orden
		</Button>
		<Button color="alternative" onclick={() => goto(resolve('/purchases/movements'))}>
			<ArrowRightLeft class="mr-2 h-4 w-4" /> Movimientos
		</Button>
	</div>

	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<Select bind:value={statusFilter} onchange={handleFilterChange} class="w-44">
			<option value="">Todos los estados</option>
			{#each ALL_PURCHASE_ORDER_STATUSES as s (s)}
				<option value={s}>{PURCHASE_ORDER_STATUS_LABELS[s]}</option>
			{/each}
		</Select>
		<Select bind:value={supplierFilter} onchange={handleFilterChange} class="w-52">
			<option value="">Todos los proveedores</option>
			{#each suppliers as supplier (supplier.id)}
				<option value={supplier.id}>{supplier.name}</option>
			{/each}
		</Select>
		<Toggle
			bind:checked={includeDeleted}
			onchange={handleFilterChange}
			class="text-sm text-slate-600"
		>
			Mostrar eliminadas
		</Toggle>
	</div>

	<PurchaseOrdersTable purchaseOrders={purchaseOrdersData.items} {loading} />

	<TablePagination
		page={purchaseOrdersData.page}
		perPage={purchaseOrdersData.perPage}
		total={purchaseOrdersData.total}
		totalPages={purchaseOrdersData.totalPages}
		onPageChange={(p) => fetchPurchaseOrders(p)}
	/>
</div>
