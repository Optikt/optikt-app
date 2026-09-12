<script lang="ts">
	import { PDFViewerModal } from '$lib/components/pdf';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ConfirmModal } from '$lib/components/ui';
	import { cancelQuote, convertQuoteToSale, assignQuoteCustomer } from '$lib/remote/quotes.remote';
	import { canOperate } from '$lib/shared/enums';
	import { getErrorMessage, getBackUrl } from '$lib/utils';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations, QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import {
		buildPersistedDisplayGroups,
		computeSnapshotTaxBreakdown,
		getSnapshotTaxLabel
	} from '$lib/components/sales/saleItemHelpers';
	import { untrack } from 'svelte';
	import QuoteDetailHeader from '$lib/components/quotes/detail/QuoteDetailHeader.svelte';
	import QuoteDetailMeta from '$lib/components/quotes/detail/QuoteDetailMeta.svelte';
	import QuoteDetailNotices from '$lib/components/quotes/detail/QuoteDetailNotices.svelte';
	import QuoteAssignCustomer from '$lib/components/quotes/detail/QuoteAssignCustomer.svelte';
	import QuoteItemsTable, {
		type QuoteDisplayGroup
	} from '$lib/components/quotes/detail/QuoteItemsTable.svelte';
	import QuoteDetailSummary from '$lib/components/quotes/detail/QuoteDetailSummary.svelte';
	import {
		quoteCustomerName,
		canSubmitAssignCustomer,
		coerceNewCustomer
	} from '$lib/components/quotes/detail/quoteDetail';

	let { data } = $props();
	let quote = $state<QuoteWithRelations>(untrack(() => data.quote));
	let items = $state<QuoteItemWithDetails[]>(untrack(() => data.items));

	let formattedQuoteNumber = $derived(`P-${String(quote.quoteNumber).padStart(4, '0')}`);
	let canAct = $derived(canOperate(data.user.role));
	let isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	let isConverted = $derived(quote.status === QuoteStatus.CONVERTED);
	let isCancelled = $derived(quote.status === QuoteStatus.CANCELLED);

	let mainItems = $derived(items.filter((i) => i.itemType !== SaleItemType.TREATMENT));

	let taxBreakdown = $derived(computeSnapshotTaxBreakdown(items, quote.snapshotTaxRate));
	let taxLabel = $derived(getSnapshotTaxLabel(quote.snapshotTaxRate));

	let displayGroups: QuoteDisplayGroup[] = $derived.by(() =>
		buildPersistedDisplayGroups(
			items,
			mainItems,
			SaleItemType.LENS_PAIR,
			SaleItemType.TREATMENT,
			(item) => item.parentQuoteItemId
		)
	);

	let actionLoading = $state(false);
	let showCancelModal = $state(false);
	let showConvertModal = $state(false);

	// PDF preview modal
	let showPdfPreview = $state(false);
	let pdfUrl = $derived(resolve(`/api/pdf/quote/${quote.id}`));

	// Customer assignment state (for DRAFT quotes without customer)
	let assignCustomerId = $state('');
	let assignSelectedCustomer = $state<Customer | null>(null);
	let assignNewCustomer = $state<NewCustomerData | null>(null);
	let assigningCustomer = $state(false);

	async function handleAssignCustomer() {
		if (!canSubmitAssignCustomer(assignCustomerId, assignNewCustomer)) {
			toast.error('Busque o ingrese un cliente primero');
			return;
		}
		assigningCustomer = true;
		try {
			const result = await assignQuoteCustomer({
				id: quote.id,
				customerId: assignCustomerId || undefined,
				newCustomer: coerceNewCustomer(assignNewCustomer)
			});
			if (result.success) {
				toast.success('Cliente asignado al presupuesto');
				await invalidateAll();
				quote = data.quote;
				items = data.items;
			} else {
				toast.error(result.error ?? 'Error asignando cliente');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error asignando cliente'));
		} finally {
			assigningCustomer = false;
		}
	}

	async function handleCancel() {
		actionLoading = true;
		try {
			const result = await cancelQuote({ id: quote.id });
			if (result.success) {
				toast.success('Presupuesto cancelado');
				showCancelModal = false;
				await invalidateAll();
				quote = data.quote;
				items = data.items;
			} else {
				toast.error(result.error ?? 'Error cancelando presupuesto');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cancelando presupuesto'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleConvert() {
		actionLoading = true;
		try {
			const result = await convertQuoteToSale({ id: quote.id });
			if (result.success) {
				toast.success('Presupuesto convertido a venta exitosamente');
				showConvertModal = false;
				goto(resolve(`/sales/${result.sale.id}`));
			} else {
				toast.error(result.error ?? 'Error convirtiendo presupuesto');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error convirtiendo presupuesto'));
		} finally {
			actionLoading = false;
		}
	}

	function goBack() {
		goto(resolve(getBackUrl('/quotes') as '/quotes'));
	}

	function openPdfQuote() {
		window.open(resolve(`/api/pdf/quote/${quote.id}`), '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>Presupuesto P-{quote.quoteNumber} - {quoteCustomerName(quote)} - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<QuoteDetailHeader
		{formattedQuoteNumber}
		{canAct}
		{isDraft}
		hasCustomer={!!quote.customer}
		onBack={goBack}
		onPreviewPdf={() => (showPdfPreview = true)}
		onOpenPdf={openPdfQuote}
		onConvert={() => (showConvertModal = true)}
		onCancel={() => (showCancelModal = true)}
	/>

	<QuoteDetailMeta {quote} {formattedQuoteNumber} />

	<QuoteDetailNotices {quote} {isCancelled} {isConverted} />

	{#if canAct && isDraft && !quote.customer}
		<QuoteAssignCustomer
			bind:assignCustomerId
			bind:assignSelectedCustomer
			bind:assignNewCustomer
			{assigningCustomer}
			onAssign={handleAssignCustomer}
		/>
	{/if}

	<QuoteItemsTable groups={displayGroups} quoteSubtotal={quote.subtotal} />

	<QuoteDetailSummary
		subtotal={quote.subtotal}
		total={quote.total}
		discountType={quote.discountType}
		discount={quote.discount}
		{taxBreakdown}
		{taxLabel}
		{isDraft}
		hasCustomer={!!quote.customer}
		{isConverted}
	/>
</div>

{#if showPdfPreview}
	<PDFViewerModal
		url={pdfUrl}
		title="Presupuesto {formattedQuoteNumber}"
		fileName={`presupuesto-${String(quote.quoteNumber).padStart(4, '0')}.pdf`}
		onClose={() => (showPdfPreview = false)}
	/>
{/if}

<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Presupuesto"
	message="¿Está seguro que desea cancelar este presupuesto?"
	confirmLabel="Cancelar Presupuesto"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>

<ConfirmModal
	bind:open={showConvertModal}
	title="Convertir a Venta"
	message={`Se creará una nueva venta a nombre de ${quoteCustomerName(quote)} con los mismos artículos de este presupuesto. Se descontará el stock correspondiente.`}
	confirmLabel="Convertir a Venta"
	confirmColor="blue"
	loading={actionLoading}
	onConfirm={handleConvert}
	onCancel={() => (showConvertModal = false)}
/>
