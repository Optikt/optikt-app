<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { FileText, Eye, CircleX } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { DataTable, QuoteStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { cancelQuote } from '$lib/remote/quotes.remote';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quotes: QuoteWithRelations[];
		loading?: boolean;
		onView?: (quote: QuoteWithRelations) => void;
		onRefresh?: () => void;
	}

	let { quotes, loading = false, onView, onRefresh }: Props = $props();

	// Cancel modal state
	let showCancelModal = $state(false);
	let selectedQuote = $state<QuoteWithRelations | null>(null);
	let actionLoading = $state(false);

	function openCancel(quote: QuoteWithRelations) {
		selectedQuote = quote;
		showCancelModal = true;
	}

	async function handleCancel() {
		if (!selectedQuote) return;
		actionLoading = true;
		try {
			const result = await cancelQuote({ id: selectedQuote.id });
			if (result.success) {
				toast.success('Presupuesto cancelado');
				showCancelModal = false;
				onRefresh?.();
			} else {
				toast.error(result.error ?? 'Error cancelando presupuesto');
			}
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cancelando presupuesto'));
		} finally {
			actionLoading = false;
		}
	}

	function customerName(quote: QuoteWithRelations): string {
		if (!quote.customer) return 'Sin cliente';
		return `${quote.customer.firstName} ${quote.customer.lastName}`;
	}
</script>

<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
	<DataTable
		items={quotes}
		{loading}
		emptyIcon={FileText}
		emptyTitle="No se encontraron presupuestos"
		emptyDescription="Crea un presupuesto para comenzar"
		{onView}
		viewIcon={Eye}
	>
		{#snippet header()}
			<TableHeadCell class="text-sm font-semibold text-slate-600">#</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Fecha</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Cliente</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Vendedor</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Total</TableHeadCell>
			<TableHeadCell class="text-sm font-semibold text-slate-600">Estado</TableHeadCell>
		{/snippet}

		{#snippet row(quote)}
			<TableBodyCell class="font-mono text-sm font-semibold text-blue-600">
				P-{quote.quoteNumber}
			</TableBodyCell>
			<TableBodyCell class="text-sm text-slate-700">
				{formatDate(quote.quoteDate, { month: 'short' })}
			</TableBodyCell>
			<TableBodyCell>
				<p class="text-sm font-semibold text-slate-900">{customerName(quote)}</p>
				{#if quote.customer?.idNumber}
					<p class="font-mono text-xs text-slate-400">{quote.customer.idNumber}</p>
				{/if}
			</TableBodyCell>
			<TableBodyCell class="text-sm text-slate-600">
				{quote.seller?.fullName ?? '—'}
			</TableBodyCell>
			<TableBodyCell class="font-mono text-sm font-bold text-slate-900">
				{formatPrice(quote.total)}
			</TableBodyCell>
			<TableBodyCell>
				<QuoteStatusBadge status={quote.status} />
			</TableBodyCell>
		{/snippet}

		{#snippet actions(quote)}
			<div class="flex items-center gap-1">
				{#if onView}
					<button
						onclick={() => onView?.(quote)}
						class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
						title="Ver detalle"
					>
						<Eye class="h-5 w-5" />
					</button>
				{/if}
				{#if quote.status === QuoteStatus.DRAFT}
					<button
						onclick={() => openCancel(quote)}
						class="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
						title="Cancelar presupuesto"
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
	title="Cancelar Presupuesto"
	message="¿Está seguro que desea cancelar este presupuesto?"
	confirmLabel="Cancelar Presupuesto"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
/>
