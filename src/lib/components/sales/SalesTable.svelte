<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { ShoppingCart, Eye, CircleX } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { DataTable, SaleStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { cancelSale } from '$lib/remote/sales.remote';
	import { SaleStatus, RefundStatus } from '$lib/shared/enums';
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
