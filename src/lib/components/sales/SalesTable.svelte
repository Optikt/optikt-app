<script lang="ts">
	import { CircleX, Eye, ReceiptText } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { DataGrid, SaleStatusBadge } from '$lib/components/ui';
	import { CancelSaleModal, SalePaymentProgress } from '$lib/components/sales';
	import { formatPrice, formatDateOnly } from '$lib/utils';
	import { SaleStatus, type UserRole, canManageSaleByOwner } from '$lib/shared/enums';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';

	type SaleViewHref = `/sales/${string}`;

	interface Props {
		sales: SaleWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		canManage?: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onView?: (sale: SaleWithRelations) => void;
		getViewHref?: (sale: SaleWithRelations) => SaleViewHref;
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
		canManage = true,
		currentUserId,
		currentUserRole,
		onView,
		getViewHref,
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
		if (!canCancelSale(sale)) return;

		selectedSale = sale;
		showCancelModal = true;
	}

	function canCancelSale(sale: SaleWithRelations): boolean {
		return (
			canManage &&
			sale.status === SaleStatus.PENDING &&
			canManageSaleByOwner(currentUserRole, currentUserId, sale.sellerId)
		);
	}

	function customerName(sale: SaleWithRelations): string {
		if (!sale.customer) return '-';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function getInitials(value: string | null | undefined): string {
		if (!value) return '?';
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
		{@const canCancel = canCancelSale(sale)}
		{@const viewHref = getViewHref?.(sale)}
		{@const sellerName = sale.seller?.fullName ?? '-'}
		<tr
			class="bg-surface-container-lowest transition-colors {onView
				? 'cursor-pointer hover:bg-surface-container-low'
				: ''}"
			onclick={() => onView?.(sale)}
		>
			<td class="px-3 py-3">
				<span class="font-mono text-sm font-semibold text-brand-navy">#{sale.orderNumber}</span>
			</td>
			<td class="px-3 py-3">
				<div class="min-w-0">
					<span class="truncate text-sm font-medium text-on-surface">{customerName(sale)}</span>
					{#if sale.customer?.idNumber}
						<span class="ml-1.5 font-mono text-xs text-outline">{sale.customer.idNumber}</span>
					{/if}
				</div>
			</td>
			<td class="px-3 py-3 text-sm whitespace-nowrap text-on-surface-variant tabular-nums">
				{formatDateOnly(sale.saleDate, { day: '2-digit', month: '2-digit', year: '2-digit' })}
			</td>
			<td class="px-3 py-3 text-right font-mono text-sm font-bold text-brand-navy tabular-nums">
				{formatPrice(sale.total)}
			</td>
			<td class="px-3 py-3">
				<div class="max-w-32">
					<SalePaymentProgress {sale} />
				</div>
			</td>
			<td class="px-3 py-3">
				<SaleStatusBadge status={sale.status} />
			</td>
			<td class="px-3 py-3">
				<div class="flex items-center gap-2" title={sellerName}>
					<div
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
					>
						{getInitials(sellerName)}
					</div>
					<span class="hidden truncate text-sm text-on-surface-variant lg:inline">
						{sellerName}
					</span>
				</div>
			</td>
			<td class="px-3 py-3 text-right">
				<div class="flex items-center justify-end gap-1">
					{#if viewHref}
						<a
							href={resolve(viewHref)}
							onclick={(event) => event.stopPropagation()}
							class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-info-container px-3 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
							title="Ver detalle"
						>
							<Eye class="h-3.5 w-3.5" />
							Ver
						</a>
					{:else if onView}
						<button
							onclick={(event) => {
								event.stopPropagation();
								onView?.(sale);
							}}
							class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-info-container px-3 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
							title="Ver detalle"
						>
							<Eye class="h-3.5 w-3.5" />
							Ver
						</button>
					{/if}
					{#if canCancel}
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
					{:else if canManage}
						<span class="inline-block w-7"></span>
					{/if}
				</div>
			</td>
		</tr>
	{/snippet}

	{#snippet mobileCard(sale)}
		{@const mobileViewHref = getViewHref?.(sale)}
		{@const sellerName = sale.seller?.fullName ?? '-'}
		{#if mobileViewHref}
			<a href={resolve(mobileViewHref)} class="block w-full space-y-3 py-1 text-left">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-mono text-sm font-semibold text-brand-navy">#{sale.orderNumber}</p>
						<p class="mt-0.5 truncate text-sm font-medium text-on-surface">
							{customerName(sale)}
						</p>
					</div>
					<SaleStatusBadge status={sale.status} />
				</div>

				<div class="grid grid-cols-3 gap-2 text-sm">
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Fecha</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-on-surface tabular-nums">
							{formatDateOnly(sale.saleDate, { day: '2-digit', month: '2-digit', year: '2-digit' })}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Total</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-brand-navy tabular-nums">
							{formatPrice(sale.total)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Por</p>
						<p
							class="mt-0.5 truncate text-xs font-semibold text-on-surface-variant"
							title={sellerName}
						>
							{sellerName}
						</p>
					</div>
				</div>

				<div class="max-w-48">
					<SalePaymentProgress {sale} compact />
				</div>
			</a>
		{:else}
			<button type="button" class="w-full space-y-3 py-1 text-left" onclick={() => onView?.(sale)}>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-mono text-sm font-semibold text-brand-navy">#{sale.orderNumber}</p>
						<p class="mt-0.5 truncate text-sm font-medium text-on-surface">
							{customerName(sale)}
						</p>
					</div>
					<SaleStatusBadge status={sale.status} />
				</div>

				<div class="grid grid-cols-3 gap-2 text-sm">
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Fecha</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-on-surface tabular-nums">
							{formatDateOnly(sale.saleDate, { day: '2-digit', month: '2-digit', year: '2-digit' })}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Total</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-brand-navy tabular-nums">
							{formatPrice(sale.total)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Por</p>
						<p
							class="mt-0.5 truncate text-xs font-semibold text-on-surface-variant"
							title={sellerName}
						>
							{sellerName}
						</p>
					</div>
				</div>

				<div class="max-w-48">
					<SalePaymentProgress {sale} compact />
				</div>
			</button>
		{/if}
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
