<script lang="ts">
	import { CircleX, Eye, ReceiptText } from '@lucide/svelte';
	import { DataGrid, SaleStatusBadge } from '$lib/components/ui';
	import { CancelSaleModal } from '$lib/components/sales';
	import { formatPrice, formatDate } from '$lib/utils';
	import { SaleStatus } from '$lib/shared/enums';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';

	interface Props {
		sales: SaleWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onView?: (sale: SaleWithRelations) => void;
		onRefresh?: () => void;
		onPageChange: (page: number) => void;
	}

	let {
		sales,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		onView,
		onRefresh,
		onPageChange
	}: Props = $props();

	const columns = [
		{ key: 'orderNumber', label: '# Orden' },
		{ key: 'customer', label: 'Cliente' },
		{ key: 'date', label: 'Fecha' },
		{ key: 'total', label: 'Total (USD)', align: 'right' as const },
		{ key: 'paid', label: 'Progreso de Pago' },
		{ key: 'status', label: 'Estado' },
		{ key: 'seller', label: 'Vendedor' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	// Cancel modal state
	let showCancelModal = $state(false);
	let selectedSale = $state<SaleWithRelations | null>(null);

	function openCancel(sale: SaleWithRelations) {
		selectedSale = sale;
		showCancelModal = true;
	}

	function customerName(sale: SaleWithRelations): string {
		if (!sale.customer) return '-';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function paidPercent(sale: SaleWithRelations): number {
		if (sale.total <= 0) return 100;
		return Math.min(100, Math.round((sale.paidAmountBcvUsd / sale.total) * 100));
	}

	function paidLabel(sale: SaleWithRelations, pct: number): string {
		if (pct >= 100) return 'Pago completo';
		if (sale.paidAmountBcvUsd > 0) return `${formatPrice(sale.paidAmountBcvUsd)} abonado`;
		return 'Sin abono';
	}
</script>

<DataGrid
	{columns}
	items={sales}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="ventas"
	emptyTitle="No se encontraron ventas"
	emptySubtitle="Registra una venta para comenzar"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<ReceiptText class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(sale)}
		{@const pct = paidPercent(sale)}
		<tr
			class="bg-surface-container-lowest transition-colors {onView
				? 'cursor-pointer hover:bg-surface-container-low'
				: ''}"
			onclick={() => onView?.(sale)}
		>
			<td class="px-4 py-4">
				<span class="font-mono text-sm font-semibold text-brand-navy">#{sale.orderNumber}</span>
			</td>
			<td class="px-4 py-4">
				<div class="font-medium text-on-surface">{customerName(sale)}</div>
				{#if sale.customer?.idNumber}
					<div class="font-mono text-xs text-outline">{sale.customer.idNumber}</div>
				{/if}
			</td>
			<td class="px-4 py-4 text-sm text-on-surface-variant">
				{formatDate(sale.saleDate, { day: '2-digit', month: 'short', year: 'numeric' })}
			</td>
			<td class="px-4 py-4 text-right font-mono text-sm font-bold text-brand-navy">
				{formatPrice(sale.total)}
			</td>
			<td class="px-4 py-4">
				<div class="max-w-32">
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
						<div
							class="h-full rounded-full transition-all {pct >= 100
								? 'bg-success'
								: pct > 0
									? 'bg-warning'
									: 'bg-outline-variant'}"
							style="width: {pct}%"
						></div>
					</div>
					<p
						class="mt-1 font-mono text-[10px] font-bold tracking-wider uppercase"
						class:text-success={pct >= 100}
						class:text-warning={pct > 0 && pct < 100}
						class:text-outline={pct === 0}
					>
						{paidLabel(sale, pct)}
					</p>
				</div>
			</td>
			<td class="px-4 py-4">
				<SaleStatusBadge status={sale.status} />
			</td>
			<td class="px-4 py-4 text-sm text-on-surface-variant">
				{sale.seller?.fullName ?? '-'}
			</td>
			<td class="px-4 py-4 text-right">
				<div class="flex items-center justify-end gap-1">
					{#if onView}
						<button
							onclick={(event) => {
								event.stopPropagation();
								onView?.(sale);
							}}
							class="rounded-md bg-info-container px-3 py-1.5 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
							title="Ver detalle"
						>
							<span class="inline-flex items-center gap-1.5">
								<Eye class="h-3.5 w-3.5" />
								Ver
							</span>
						</button>
					{/if}
					{#if sale.status === SaleStatus.PENDING}
						<button
							onclick={(event) => {
								event.stopPropagation();
								openCancel(sale);
							}}
							class="rounded-md p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
							title="Cancelar venta"
						>
							<CircleX class="h-4 w-4" />
						</button>
					{:else}
						<span class="inline-block w-7"></span>
					{/if}
				</div>
			</td>
		</tr>
	{/snippet}
</DataGrid>

<!-- Cancel Confirmation -->
{#if selectedSale}
	<CancelSaleModal
		bind:open={showCancelModal}
		saleId={selectedSale.id}
		paidAmountBcvUsd={selectedSale.paidAmountBcvUsd}
		onSuccess={() => onRefresh?.()}
	/>
{/if}
