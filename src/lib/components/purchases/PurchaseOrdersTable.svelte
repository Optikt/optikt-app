<script lang="ts">
	import { ClipboardList, Eye } from '@lucide/svelte';
	import { DataGrid, PurchaseOrderStatusBadge } from '$lib/components/ui';
	import { formatCurrency, formatDate } from '$lib/utils';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';

	interface Props {
		purchaseOrders: PurchaseOrderWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onView?: (purchaseOrder: PurchaseOrderWithRelations) => void;
		onPageChange: (page: number) => void;
	}

	let {
		purchaseOrders,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		onView,
		onPageChange
	}: Props = $props();

	const columns = [
		{ key: 'order', label: 'N° orden' },
		{ key: 'supplier', label: 'Proveedor' },
		{ key: 'date', label: 'Fecha' },
		{ key: 'invoice', label: 'Factura' },
		{ key: 'rate', label: 'Tasa BCV' },
		{ key: 'status', label: 'Estado' },
		{ key: 'createdBy', label: 'Creado por' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	function formatOrderNumber(orderNumber: number): string {
		return `PO-${String(orderNumber).padStart(4, '0')}`;
	}

	function getInitials(value: string | null | undefined): string {
		if (!value) return '-';
		return value
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((chunk) => chunk[0]?.toUpperCase() ?? '')
			.join('');
	}
</script>

<DataGrid
	{columns}
	items={purchaseOrders}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="órdenes"
	emptyTitle="No se encontraron órdenes de compra"
	emptySubtitle="Ajusta los filtros o crea una nueva orden para comenzar"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<ClipboardList class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(purchaseOrder)}
		<tr
			class="bg-surface-container-lowest transition-colors {onView
				? 'cursor-pointer hover:bg-surface-container-low'
				: ''}"
			onclick={() => onView?.(purchaseOrder)}
		>
			<td class="px-4 py-4">
				<span class="font-mono text-sm font-semibold text-brand-navy">
					{formatOrderNumber(purchaseOrder.orderNumber)}
				</span>
			</td>
			<td class="px-4 py-4">
				<div class="flex min-w-[15rem] items-center gap-3">
					<div
						class="flex h-9 w-9 items-center justify-center rounded-lg bg-info-container text-xs font-bold text-on-info-container"
					>
						{getInitials(purchaseOrder.supplier?.name)}
					</div>
					<div>
						<p class="font-medium text-on-surface">
							{purchaseOrder.supplier?.name ?? 'Sin proveedor'}
						</p>
					</div>
				</div>
			</td>
			<td class="px-4 py-4 text-sm text-on-surface-variant">
				{formatDate(purchaseOrder.orderDate, { day: '2-digit', month: 'short', year: 'numeric' })}
			</td>
			<td class="px-4 py-4">
				<span
					class="font-mono text-sm {purchaseOrder.invoiceNumber
						? 'text-on-surface-variant'
						: 'text-outline italic'}"
				>
					{purchaseOrder.invoiceNumber ?? 'Pendiente'}
				</span>
			</td>
			<td class="px-4 py-4">
				<span class="font-mono text-sm text-on-surface-variant tabular-nums">
					{formatCurrency(purchaseOrder.bcvRate)} Bs
				</span>
			</td>
			<td class="px-4 py-4">
				<PurchaseOrderStatusBadge status={purchaseOrder.status} />
			</td>
			<td class="px-4 py-4">
				<div class="flex items-center gap-2">
					<div
						class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
					>
						{getInitials(purchaseOrder.createdBy?.fullName ?? 'Sistema')}
					</div>
					<span class="text-sm text-on-surface-variant">
						{purchaseOrder.createdBy?.fullName ?? 'Sistema'}
					</span>
				</div>
			</td>
			<td class="px-4 py-4 text-right">
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onView?.(purchaseOrder);
					}}
					class="rounded-md bg-info-container px-3 py-1.5 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver detalle"
				>
					<span class="inline-flex items-center gap-1.5">
						<Eye class="h-3.5 w-3.5" />
						Ver
					</span>
				</button>
			</td>
		</tr>
	{/snippet}
</DataGrid>
