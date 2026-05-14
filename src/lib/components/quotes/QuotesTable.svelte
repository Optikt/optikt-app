<script lang="ts">
	import { Eye, CircleX, ClipboardList } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { DataGrid, QuoteStatusBadge, ConfirmModal } from '$lib/components/ui';
	import { formatPrice, formatDateOnly, getErrorMessage } from '$lib/utils';
	import { cancelQuote } from '$lib/remote/quotes.remote';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quotes: QuoteWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		canManage?: boolean;
		onView?: (quote: QuoteWithRelations) => void;
		onRefresh?: () => void;
		onPageChange: (page: number) => void;
	}

	let {
		quotes,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		canManage = true,
		onView,
		onRefresh,
		onPageChange
	}: Props = $props();

	const columns = [
		{ key: 'quoteNumber', label: '# Presupuesto' },
		{ key: 'customer', label: 'Cliente' },
		{ key: 'date', label: 'Fecha' },
		{ key: 'total', label: 'Total (USD)', align: 'right' as const },
		{ key: 'status', label: 'Estado' },
		{ key: 'seller', label: 'Vendedor' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	// Cancel modal state
	let showCancelModal = $state(false);
	let selectedQuote = $state<QuoteWithRelations | null>(null);
	let actionLoading = $state(false);

	function openCancel(quote: QuoteWithRelations) {
		if (!canManage) return;

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

<DataGrid
	{columns}
	items={quotes}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="presupuestos"
	emptyTitle="No se encontraron presupuestos"
	emptySubtitle="Crea un presupuesto para comenzar"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<ClipboardList class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(quote)}
		<tr
			class="bg-surface-container-lowest transition-colors {onView
				? 'cursor-pointer hover:bg-surface-container-low'
				: ''}"
			onclick={() => onView?.(quote)}
		>
			<td class="px-4 py-4">
				<span class="font-mono text-sm font-semibold text-brand-blue">P-{quote.quoteNumber}</span>
			</td>
			<td class="px-4 py-4">
				<div class="font-medium text-on-surface">{customerName(quote)}</div>
				{#if quote.customer?.idNumber}
					<div class="font-mono text-xs text-outline">{quote.customer.idNumber}</div>
				{/if}
			</td>
			<td class="px-4 py-4 text-sm text-on-surface-variant">
				{formatDateOnly(quote.quoteDate, { day: '2-digit', month: 'short', year: 'numeric' })}
			</td>
			<td class="px-4 py-4 text-right font-mono text-sm font-bold text-brand-navy">
				{formatPrice(quote.total)}
			</td>
			<td class="px-4 py-4">
				<QuoteStatusBadge status={quote.status} />
			</td>
			<td class="px-4 py-4 text-sm text-on-surface-variant">
				{quote.seller?.fullName ?? '-'}
			</td>
			<td class="px-4 py-4 text-right">
				<div class="flex items-center justify-end gap-1">
					{#if onView}
						<button
							onclick={(event) => {
								event.stopPropagation();
								onView?.(quote);
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
					{#if canManage && quote.status === QuoteStatus.DRAFT}
						<button
							onclick={(event) => {
								event.stopPropagation();
								openCancel(quote);
							}}
							class="rounded-md p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
							title="Cancelar presupuesto"
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
</DataGrid>

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
