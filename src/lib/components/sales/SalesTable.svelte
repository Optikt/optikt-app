<script lang="ts">
	import { CircleX, Eye, ReceiptText } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ConfirmModal, DataGrid, SaleStatusBadge } from '$lib/components/ui';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { cancelSale } from '$lib/remote/sales.remote';
	import { SaleStatus, RefundStatus } from '$lib/shared/enums';
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
	let actionLoading = $state(false);
	let cancelReason = $state('');
	let cancelReasonError = $state('');

	// Refund state for cancel modal
	let hasPriorPayments = $derived(selectedSale ? selectedSale.paidAmountBcvUsd > 0 : false);
	let refundStatus = $state<string>(RefundStatus.RETAINED);
	let refundNotes = $state('');
	let refundNotesError = $state('');

	const CANCEL_REASON_SUGGESTIONS = [
		'Error en el pedido',
		'Solicitud del cliente',
		'Producto no disponible',
		'Error en los datos de la venta'
	];

	function selectCancelSuggestion(suggestion: string) {
		cancelReason = suggestion;
		cancelReasonError = '';
	}

	function openCancel(sale: SaleWithRelations) {
		selectedSale = sale;
		cancelReason = '';
		cancelReasonError = '';
		refundStatus = RefundStatus.RETAINED;
		refundNotes = '';
		refundNotesError = '';
		showCancelModal = true;
	}

	async function handleCancel() {
		if (!selectedSale) return;
		if (cancelReason.trim().length < 10) {
			cancelReasonError = 'El motivo debe tener al menos 10 caracteres';
			return;
		}
		cancelReasonError = '';

		// Validate refund fields when payments exist
		let hasRefundError = false;
		if (hasPriorPayments) {
			const needsDetails =
				refundStatus === RefundStatus.REFUNDED || refundStatus === RefundStatus.RETAINED;
			if (needsDetails) {
				if (!refundNotes || refundNotes.trim().length < 10) {
					refundNotesError = 'La nota debe tener al menos 10 caracteres';
					hasRefundError = true;
				} else {
					refundNotesError = '';
				}
			}
		}
		if (hasRefundError) return;

		actionLoading = true;
		try {
			const result = await cancelSale({
				id: selectedSale.id,
				reason: cancelReason.trim(),
				refundStatus: hasPriorPayments ? refundStatus : RefundStatus.NO_PAYMENT,
				refundNotes: hasPriorPayments ? refundNotes.trim() : undefined
			});
			if (result.success) {
				toast.success('Venta cancelada');
				showCancelModal = false;
				cancelReason = '';
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
				{sale.seller?.fullName ?? '—'}
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
					{/if}
				</div>
			</td>
		</tr>
	{/snippet}
</DataGrid>

<!-- Cancel Confirmation -->
<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Venta"
	confirmLabel="Cancelar Venta"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => {
		showCancelModal = false;
		cancelReason = '';
		cancelReasonError = '';
		refundStatus = RefundStatus.RETAINED;
		refundNotes = '';
		refundNotesError = '';
	}}
>
	{#snippet body()}
		<p class="mb-3 text-sm text-gray-700">
			¿Está seguro que desea cancelar esta venta? Se restaurará el stock de los productos y lentes.
		</p>
		<div class="mb-2 flex flex-wrap gap-1.5">
			{#each CANCEL_REASON_SUGGESTIONS as suggestion (suggestion)}
				<button
					type="button"
					class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {cancelReason ===
					suggestion
						? 'border-red-300 bg-red-50 text-red-700'
						: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
					onclick={() => selectCancelSuggestion(suggestion)}
				>
					{suggestion}
				</button>
			{/each}
		</div>
		<textarea
			class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-red-400 focus:ring-1 focus:ring-red-400"
			rows="3"
			placeholder="Motivo de cancelación (mínimo 10 caracteres)..."
			bind:value={cancelReason}
			oninput={() => (cancelReasonError = '')}
		></textarea>
		{#if cancelReasonError}
			<p class="mt-1 text-xs text-red-600">{cancelReasonError}</p>
		{/if}

		<!-- Refund section: only when sale has prior payments -->
		{#if hasPriorPayments && selectedSale}
			<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
				<p class="mb-1 text-sm font-semibold text-amber-800">
					Esta venta tiene pagos por {formatPrice(selectedSale.paidAmountBcvUsd)}.
				</p>
				<p class="mb-3 text-sm text-amber-700">¿Qué desea hacer con este monto?</p>
				<div class="mb-3 flex gap-3">
					<label
						class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors {refundStatus ===
						RefundStatus.RETAINED
							? 'border-amber-400 bg-amber-100 text-amber-800'
							: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
					>
						<input
							type="radio"
							name="refundStatus"
							value={RefundStatus.RETAINED}
							bind:group={refundStatus}
							class="accent-amber-600"
						/>
						Retener — {formatPrice(selectedSale.paidAmountBcvUsd)} se quedan en el negocio
					</label>
					<label
						class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors {refundStatus ===
						RefundStatus.REFUNDED
							? 'border-red-400 bg-red-100 text-red-800'
							: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
					>
						<input
							type="radio"
							name="refundStatus"
							value={RefundStatus.REFUNDED}
							bind:group={refundStatus}
							class="accent-red-600"
						/>
						Reembolsar — {formatPrice(selectedSale.paidAmountBcvUsd)} se devuelven al cliente
					</label>
				</div>
				<p class="mb-3 text-xs text-amber-600">
					Para reembolsos parciales, seleccione «Retener» y registre el ajuste como gasto manual.
				</p>
				<div>
					<label for="refundNotesTable" class="mb-1 block text-xs font-medium text-slate-700">
						Nota ({refundStatus === RefundStatus.REFUNDED ? 'reembolso' : 'retención'})
					</label>
					<textarea
						id="refundNotesTable"
						class="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
						rows="2"
						placeholder="Detalle sobre la decisión (mínimo 10 caracteres)..."
						bind:value={refundNotes}
						oninput={() => (refundNotesError = '')}
					></textarea>
					{#if refundNotesError}
						<p class="mt-1 text-xs text-red-600">{refundNotesError}</p>
					{/if}
				</div>
			</div>
		{/if}
	{/snippet}
</ConfirmModal>
