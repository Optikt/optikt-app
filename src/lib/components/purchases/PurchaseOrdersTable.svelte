<script lang="ts">
	import { ClipboardList, Eye } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { DataGrid, PurchaseOrderDueBadge, PurchaseOrderStatusBadge } from '$lib/components/ui';
import {
	getPurchaseDocumentTypeLabel,
	PurchaseDiscountType,
	PurchaseDocumentType,
	CurrencyCode
} from '$lib/shared/enums';
import { getSettlementCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
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
		{ key: 'rate', label: 'Tasa BCV', hiddenClass: 'hidden 2xl:table-cell' },
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
		const b = purchaseOrder.balance;
		if (!b) return formatPrice(0);
		if (b.settlementCurrency && b.settlementCurrency !== CurrencyCode.USD_BCV) {
			const sym = getSettlementCurrencySymbol(b.settlementCurrency);
			return `${b.settlementBalance.toFixed(2)} ${sym}`;
		}
		return formatPrice(b.balance);
	}

	function shortDate(date: Date | string | null | undefined): string {
		if (!date) return '--';
		return formatDateOnly(date, { day: '2-digit', month: '2-digit', year: '2-digit' });
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
		{@const creatorName = purchaseOrder.createdBy?.fullName ?? 'Sistema'}
		<tr
			class="bg-surface-container-lowest transition-colors {onView
				? 'cursor-pointer hover:bg-surface-container-low'
				: ''}"
			onclick={() => onView?.(purchaseOrder)}
		>
			<td class="px-3 py-3">
				<span class="font-mono text-sm font-semibold text-brand-navy">
					{formatOrderNumber(purchaseOrder.orderNumber)}
				</span>
			</td>
			<td class="px-3 py-3">
				<div class="flex items-center gap-2">
					<div
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-container text-[10px] font-bold text-on-info-container"
					>
						{getInitials(purchaseOrder.supplier?.name)}
					</div>
					<span class="min-w-0 truncate text-sm font-medium text-on-surface">
						{purchaseOrder.supplier?.name ?? 'Sin proveedor'}
					</span>
				</div>
			</td>
			<td class="px-3 py-3 text-sm whitespace-nowrap text-on-surface-variant tabular-nums">
				{shortDate(purchaseOrder.orderDate)}
			</td>
			<td class="px-3 py-3">
				<div
					class="max-w-[7rem] truncate text-sm"
					title="{documentLabel(purchaseOrder)}: {documentNumber(purchaseOrder)}"
				>
					<span class="text-xs font-medium text-on-surface-variant"
						>{documentLabel(purchaseOrder)}</span
					>
					<span
						class="ml-1 font-mono text-sm {documentNumber(purchaseOrder) === '--'
							? 'text-outline'
							: 'text-on-surface'}"
					>
						{documentNumber(purchaseOrder)}
					</span>
					{#if settlementDiscountLabel(purchaseOrder)}
						<span
							class="ml-1 inline-flex items-center rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-brand-gold-dark uppercase"
						>
							{settlementDiscountLabel(purchaseOrder)}
						</span>
					{/if}
				</div>
			</td>
			<td class="hidden px-3 py-3 2xl:table-cell">
				<span class="font-mono text-sm text-on-surface-variant tabular-nums">
					{formatCurrency(purchaseOrder.bcvRate)} Bs
				</span>
			</td>
			<td class="px-3 py-3">
				<div class="flex flex-col items-start gap-1">
					<PurchaseOrderStatusBadge
						status={purchaseOrder.status}
						isReadyForReview={purchaseOrder.isReadyForReview}
					/>
					<PurchaseOrderDueBadge dueStatus={purchaseOrder.dueStatus} />
				</div>
			</td>
			<td class="px-3 py-3 text-right">
				<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
					{pendingBalanceLabel(purchaseOrder)}
				</span>
			</td>
			<td class="px-3 py-3">
				<div class="flex items-center gap-2" title={creatorName}>
					<div
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
					>
						{getInitials(creatorName)}
					</div>
					<span class="hidden truncate text-sm text-on-surface-variant lg:inline">
						{creatorName}
					</span>
				</div>
			</td>
			<td class="px-3 py-3 text-right">
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
				{:else}
					<button
						type="button"
						onclick={(event) => {
							event.stopPropagation();
							onView?.(purchaseOrder);
						}}
						class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-info-container px-3 text-xs font-semibold text-on-info-container transition-colors hover:bg-brand-blue-light/40"
						title="Ver detalle"
					>
						<Eye class="h-3.5 w-3.5" />
						Ver
					</button>
				{/if}
			</td>
		</tr>
	{/snippet}

	{#snippet mobileCard(purchaseOrder)}
		{@const mobileViewHref = getViewHref?.(purchaseOrder)}
		{@const creatorName = purchaseOrder.createdBy?.fullName ?? 'Sistema'}
		{#if mobileViewHref}
			<a href={resolve(mobileViewHref)} class="block w-full space-y-3 py-1 text-left">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-mono text-sm font-semibold text-brand-navy">
							{formatOrderNumber(purchaseOrder.orderNumber)}
						</p>
						<p class="mt-0.5 truncate text-sm font-medium text-on-surface">
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

				<div class="grid grid-cols-3 gap-2 text-sm">
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Fecha</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-on-surface tabular-nums">
							{shortDate(purchaseOrder.orderDate)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Saldo</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-brand-navy tabular-nums">
							{pendingBalanceLabel(purchaseOrder)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Por</p>
						<p
							class="mt-0.5 truncate text-xs font-semibold text-on-surface-variant"
							title={creatorName}
						>
							{creatorName}
						</p>
					</div>
				</div>

				{#if settlementDiscountLabel(purchaseOrder)}
					<span
						class="inline-flex items-center rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand-gold-dark uppercase"
					>
						{settlementDiscountLabel(purchaseOrder)}
					</span>
				{/if}
			</a>
		{:else}
			<button
				type="button"
				class="w-full space-y-3 py-1 text-left"
				onclick={() => onView?.(purchaseOrder)}
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-mono text-sm font-semibold text-brand-navy">
							{formatOrderNumber(purchaseOrder.orderNumber)}
						</p>
						<p class="mt-0.5 truncate text-sm font-medium text-on-surface">
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

				<div class="grid grid-cols-3 gap-2 text-sm">
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Fecha</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-on-surface tabular-nums">
							{shortDate(purchaseOrder.orderDate)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Saldo</p>
						<p class="mt-0.5 font-mono text-xs font-semibold text-brand-navy tabular-nums">
							{pendingBalanceLabel(purchaseOrder)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="text-[9px] font-semibold tracking-wider text-outline uppercase">Por</p>
						<p
							class="mt-0.5 truncate text-xs font-semibold text-on-surface-variant"
							title={creatorName}
						>
							{creatorName}
						</p>
					</div>
				</div>

				{#if settlementDiscountLabel(purchaseOrder)}
					<span
						class="inline-flex items-center rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand-gold-dark uppercase"
					>
						{settlementDiscountLabel(purchaseOrder)}
					</span>
				{/if}
			</button>
		{/if}
	{/snippet}
</DataGrid>
