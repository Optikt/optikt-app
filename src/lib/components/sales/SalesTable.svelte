<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { ShoppingCart, Eye, CircleX } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { DataTable, SaleStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { cancelSale } from '$lib/remote/sales.remote';
	import { SaleStatus } from '$lib/shared/enums';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';

	interface Props {
		sales: SaleWithRelations[];
		loading?: boolean;
		onView?: (sale: SaleWithRelations) => void;
		onRefresh?: () => void;
	}

	let { sales, loading = false, onView, onRefresh }: Props = $props();

	// Cancel modal state
	let showCancelModal = $state(false);
	let selectedSale = $state<SaleWithRelations | null>(null);
	let actionLoading = $state(false);

	function openCancel(sale: SaleWithRelations) {
		selectedSale = sale;
		showCancelModal = true;
	}

	async function handleCancel() {
		if (!selectedSale) return;
		actionLoading = true;
		try {
			const result = await cancelSale({ id: selectedSale.id });
			if (result.success) {
				toast.success('Venta cancelada');
				showCancelModal = false;
				onRefresh?.();
			} else {
				toast.error(result.error ?? 'Error cancelando venta');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cancelando venta'));
		} finally {
			actionLoading = false;
		}
	}

	function customerName(sale: SaleWithRelations): string {
		if (!sale.customer) return '—';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function paidPercent(sale: SaleWithRelations): number {
		if (sale.total <= 0) return 100;
		return Math.min(100, Math.round((sale.paidAmountBcvUsd / sale.total) * 100));
	}
</script>

<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
	<DataTable
		items={sales}
		{loading}
		emptyIcon={ShoppingCart}
		emptyTitle="No se encontraron ventas"
		emptyDescription="Registra una venta para comenzar"
		{onView}
		viewIcon={Eye}
	>
		{#snippet header()}
			<TableHeadCell class="text-sm font-semibold text-slate-600">#</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Fecha</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Cliente</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Vendedor</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Total</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Pagado</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Estado</TableHeadCell>
		{/snippet}

		{#snippet row(sale)}
			<TableBodyCell class="font-mono text-sm font-semibold text-blue-600">
				#{sale.orderNumber}
			</TableBodyCell>
			<TableBodyCell class="text-sm text-slate-700">
				{formatDate(sale.saleDate, { month: 'short' })}
			</TableBodyCell>
			<TableBodyCell>
				<p class="text-sm font-semibold text-slate-900">{customerName(sale)}</p>
				{#if sale.customer?.idNumber}
					<p class="font-mono text-xs text-slate-400">{sale.customer.idNumber}</p>
				{/if}
			</TableBodyCell>
			<TableBodyCell class="text-sm text-slate-600">
				{sale.seller?.fullName ?? '—'}
			</TableBodyCell>
			<TableBodyCell class="font-mono text-sm font-bold text-slate-900">
				{formatPrice(sale.total)}
			</TableBodyCell>
			<TableBodyCell>
				{@const pct = paidPercent(sale)}
				<div class="flex items-center gap-2">
					<div class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
						<div
							class="h-full rounded-full transition-all {pct >= 100
								? 'bg-emerald-500'
								: pct > 0
									? 'bg-amber-400'
									: 'bg-slate-200'}"
							style="width: {pct}%"
						></div>
					</div>
					<span
						class="font-mono text-sm font-medium"
						class:text-emerald-600={pct >= 100}
						class:text-amber-600={pct > 0 && pct < 100}
						class:text-slate-400={pct === 0}
					>
						{pct}%
					</span>
				</div>
			</TableBodyCell>
			<TableBodyCell>
				<SaleStatusBadge status={sale.status} />
			</TableBodyCell>
		{/snippet}

		{#snippet actions(sale)}
			<div class="flex items-center gap-1">
				{#if onView}
					<button
						onclick={() => onView?.(sale)}
						class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
						title="Ver detalle"
					>
						<Eye class="h-5 w-5" />
					</button>
				{/if}
				{#if sale.status === SaleStatus.PENDING}
					<button
						onclick={() => openCancel(sale)}
						class="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
						title="Cancelar venta"
					>
						<CircleX class="h-5 w-5" />
					</button>
				{/if}
			</div>
		{/snippet}
	</DataTable>
</div>

<!-- Cancel Confirmation -->
<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Venta"
	message="¿Está seguro que desea cancelar esta venta? Se restaurará el stock de los productos y lentes."
	confirmLabel="Cancelar Venta"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>
