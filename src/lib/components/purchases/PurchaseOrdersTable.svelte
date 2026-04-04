<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { ClipboardList, Eye } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { DataTable, ActionButton, PurchaseOrderStatusBadge } from '$lib/components/ui';
	import { formatPrice, formatDate } from '$lib/utils';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';

	interface Props {
		purchaseOrders: PurchaseOrderWithRelations[];
		loading?: boolean;
	}

	let { purchaseOrders, loading = false }: Props = $props();

	function viewDetail(po: PurchaseOrderWithRelations) {
		goto(resolve(`/purchases/${po.id}`));
	}
</script>

<DataTable
	items={purchaseOrders}
	{loading}
	emptyIcon={ClipboardList}
	emptyTitle="No se encontraron órdenes de compra"
	emptyDescription="Crea una orden de compra para comenzar"
>
	{#snippet header()}
		<TableHeadCell class="w-24 font-semibold">N° Orden</TableHeadCell>
		<TableHeadCell class="font-semibold">Proveedor</TableHeadCell>
		<TableHeadCell class="font-semibold">Fecha</TableHeadCell>
		<TableHeadCell class="font-semibold">N° Factura</TableHeadCell>
		<TableHeadCell class="font-semibold">Tasa BCV</TableHeadCell>
		<TableHeadCell class="font-semibold">Estado</TableHeadCell>
		<TableHeadCell class="font-semibold">Creado por</TableHeadCell>
	{/snippet}

	{#snippet row(po)}
		<TableBodyCell class="font-mono text-sm font-medium">
			PO-{String(po.orderNumber).padStart(4, '0')}
		</TableBodyCell>
		<TableBodyCell class="font-medium">
			{po.supplier?.name ?? '—'}
		</TableBodyCell>
		<TableBodyCell>
			{formatDate(po.orderDate)}
		</TableBodyCell>
		<TableBodyCell>
			<span class="font-mono text-sm text-slate-600">{po.invoiceNumber ?? '—'}</span>
		</TableBodyCell>
		<TableBodyCell>
			<span class="font-mono text-sm tabular-nums">{formatPrice(po.bcvRate)}</span>
		</TableBodyCell>
		<TableBodyCell>
			<PurchaseOrderStatusBadge status={po.status} />
		</TableBodyCell>
		<TableBodyCell>
			{po.createdBy?.fullName ?? '—'}
		</TableBodyCell>
	{/snippet}

	{#snippet actions(po)}
		<ActionButton icon={Eye} title="Ver detalle" onclick={() => viewDetail(po)} />
	{/snippet}
</DataTable>
