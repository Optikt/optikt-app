<script lang="ts">
	import { ClipboardList, Eye } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { DataGrid, PurchaseOrderDueBadge, PurchaseOrderStatusBadge } from '$lib/components/ui';
	import {
		getPurchaseDocumentTypeLabel,
		PurchaseDiscountType,
		PurchaseDocumentType
	} from '$lib/shared/enums';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';

	type PurchaseViewHref = `/purchases/${string}`;

	interface Props {
		purchaseOrders: PurchaseOrderWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onView?: (purchaseOrder: PurchaseOrderWithRelations) => void;
		getViewHref?: (purchaseOrder: PurchaseOrderWithRelations) => PurchaseViewHref;
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
		getViewHref,
		onPageChange
	}: Props = $props();

	const columns = [
		{ key: 'order', label: 'N° orden' },
		{ key: 'supplier', label: 'Proveedor' },
		{ key: 'date', label: 'Fecha' },
		{ key: 'document', label: 'Documento' },
		{ key: 'rate', label: 'Tasa BCV' },
		{ key: 'status', label: 'Estado' },
		{ key: 'balance', label: 'Saldo', align: 'right' as const },
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

	function documentLabel(purchaseOrder: PurchaseOrderWithRelations): string {
		return getPurchaseDocumentTypeLabel(purchaseOrder.documentType);
	}

	function documentNumber(purchaseOrder: PurchaseOrderWithRelations): string {
		if (purchaseOrder.documentType === PurchaseDocumentType.DELIVERY_NOTE) {
			return purchaseOrder.deliveryNoteNumber || '--';
		}

		return purchaseOrder.invoiceNumber || '--';
	}

	function settlementDiscountLabel(purchaseOrder: PurchaseOrderWithRelations): string | null {
		const type = purchaseOrder.settlementDiscountType ?? PurchaseDiscountType.NONE;
		const value = Number(purchaseOrder.settlementDiscountValue ?? 0);
		if (type === PurchaseDiscountType.NONE || value <= 0) return null;
		if (type === PurchaseDiscountType.PERCENT) return `Desc. ${value}%`;
		return `Desc. ${formatPrice(value)}`;
	}

	function pendingBalanceLabel(purchaseOrder: PurchaseOrderWithRelations): string {
		return formatPrice(purchaseOrder.balance?.balance ?? 0);
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
		{@const viewHref = getViewHref?.(purchaseOrder)}
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
				{formatDateOnly(purchaseOrder.orderDate, {
					day: '2-digit',
					month: 'short',
					year: 'numeric'
				})}
			</td>
			<td class="px-4 py-4">
				<div class="min-w-[9rem] space-y-1">
					<p class="text-[11px] font-semibold text-slate-500 uppercase">
						{documentLabel(purchaseOrder)}
					</p>
					<span
						class="font-mono text-sm {documentNumber(purchaseOrder) === '--'
							? 'text-outline'
							: 'text-on-surface-variant'}"
					>
						{documentNumber(purchaseOrder)}
					</span>
					{#if settlementDiscountLabel(purchaseOrder)}
						<span
							class="mt-1 inline-flex items-center self-start rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-brand-gold-dark uppercase"
						>
							{settlementDiscountLabel(purchaseOrder)}
						</span>
					{/if}
				</div>
			</td>
			<td class="px-4 py-4">
				<span class="font-mono text-sm text-on-surface-variant tabular-nums">
					{formatCurrency(purchaseOrder.bcvRate)} Bs
				</span>
			</td>
			<td class="px-4 py-4">
				<div class="flex min-w-[8rem] flex-col items-start gap-1.5">
					<PurchaseOrderStatusBadge
						status={purchaseOrder.status}
						isReadyForReview={purchaseOrder.isReadyForReview}
					/>
					<PurchaseOrderDueBadge dueStatus={purchaseOrder.dueStatus} />
				</div>
			</td>
			<td class="px-4 py-4 text-right">
				<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
					{pendingBalanceLabel(purchaseOrder)}
				</span>
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
				{#if viewHref}
					<a
						href={resolve(viewHref)}
						onclick={(event) => event.stopPropagation()}
						class="rounded-md bg-info-container px-3 py-1.5 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
						title="Ver detalle"
					>
						<span class="inline-flex items-center gap-1.5">
							<Eye class="h-3.5 w-3.5" />
							Ver
						</span>
					</a>
				{:else}
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
				{/if}
			</td>
		</tr>
	{/snippet}

	{#snippet mobileCard(purchaseOrder)}
		{@const mobileViewHref = getViewHref?.(purchaseOrder)}
		{#if mobileViewHref}
			<a href={resolve(mobileViewHref)} class="block w-full space-y-4 text-left">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-mono text-sm font-semibold text-brand-navy">
							{formatOrderNumber(purchaseOrder.orderNumber)}
						</p>
						<p class="mt-1 truncate text-sm font-medium text-on-surface">
							{purchaseOrder.supplier?.name ?? 'Sin proveedor'}
						</p>
					</div>
					<div class="flex shrink-0 flex-col items-end gap-1.5">
						<PurchaseOrderStatusBadge
							status={purchaseOrder.status}
							isReadyForReview={purchaseOrder.isReadyForReview}
						/>
						<PurchaseOrderDueBadge dueStatus={purchaseOrder.dueStatus} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-2 text-sm">
					<div class="rounded-xl bg-surface-container-low px-3 py-3">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Documento
						</p>
						<p class="mt-1 text-[11px] font-semibold text-on-surface-variant uppercase">
							{documentLabel(purchaseOrder)}
						</p>
						<p class="font-mono text-sm font-semibold text-brand-navy">
							{documentNumber(purchaseOrder)}
						</p>
					</div>
					<div class="rounded-xl bg-surface-container-low px-3 py-3 text-right">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Saldo</p>
						<p class="mt-1 font-mono text-sm font-semibold text-brand-navy tabular-nums">
							{pendingBalanceLabel(purchaseOrder)}
						</p>
						<p class="mt-1 text-[11px] text-on-surface-variant">
							{formatDateOnly(purchaseOrder.orderDate, { day: '2-digit', month: 'short' })}
						</p>
					</div>
				</div>
			</a>
		{:else}
			<button
				type="button"
				class="w-full space-y-4 text-left"
				onclick={() => onView?.(purchaseOrder)}
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-mono text-sm font-semibold text-brand-navy">
							{formatOrderNumber(purchaseOrder.orderNumber)}
						</p>
						<p class="mt-1 truncate text-sm font-medium text-on-surface">
							{purchaseOrder.supplier?.name ?? 'Sin proveedor'}
						</p>
					</div>
					<div class="flex shrink-0 flex-col items-end gap-1.5">
						<PurchaseOrderStatusBadge
							status={purchaseOrder.status}
							isReadyForReview={purchaseOrder.isReadyForReview}
						/>
						<PurchaseOrderDueBadge dueStatus={purchaseOrder.dueStatus} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-2 text-sm">
					<div class="rounded-xl bg-surface-container-low px-3 py-3">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
							Documento
						</p>
						<p class="mt-1 text-[11px] font-semibold text-on-surface-variant uppercase">
							{documentLabel(purchaseOrder)}
						</p>
						<p class="font-mono text-sm font-semibold text-brand-navy">
							{documentNumber(purchaseOrder)}
						</p>
					</div>
					<div class="rounded-xl bg-surface-container-low px-3 py-3 text-right">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Saldo</p>
						<p class="mt-1 font-mono text-sm font-semibold text-brand-navy tabular-nums">
							{pendingBalanceLabel(purchaseOrder)}
						</p>
						<p class="mt-1 text-[11px] text-on-surface-variant">
							{formatDateOnly(purchaseOrder.orderDate, { day: '2-digit', month: 'short' })}
						</p>
					</div>
				</div>
			</button>
		{/if}
	{/snippet}
</DataGrid>
