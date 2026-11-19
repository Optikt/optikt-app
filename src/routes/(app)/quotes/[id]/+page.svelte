<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import { cancelQuote } from '$lib/remote/quotes/lifecycle.remote';
	import SaleItemsTable from '$lib/components/sales/itemsTable/SaleItemsTable.svelte';
	import { canOperate } from '$lib/shared/enums';
	import { getErrorMessage, replaceUrlSearch } from '$lib/utils';
	import { logger } from '$lib/utils/logger';
	import { toast } from 'svelte-sonner';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type {
		QuoteItemWithDetails,
		QuoteWithRelations
	} from '$lib/server/db/queries/quotes/types';
	import type { QuoteConversionPreview } from '$lib/shared/quotes/conversionPreview';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import {
		buildQuoteDisplayGroups,
		quoteItemToDisplayItem
	} from '$lib/components/quotes/detail/quoteItemsAdapter';
	import QuoteDetailHero from '$lib/components/quotes/detail/QuoteDetailHero.svelte';
	import QuoteDetailMobileBar from '$lib/components/quotes/detail/QuoteDetailMobileBar.svelte';
	import QuoteAuditTimeline from '$lib/components/quotes/detail/QuoteAuditTimeline.svelte';
	import QuoteAuditHistoryDrawer from '$lib/components/quotes/detail/QuoteAuditHistoryDrawer.svelte';
	import QuoteConvertModal from '$lib/components/quotes/convert/QuoteConvertModal.svelte';
	import EditSaleModal from '$lib/components/sales/EditSaleModal.svelte';
	import { classifyQuoteAuditEntry } from '$lib/components/quotes/detail/quoteAudit';
	import type { AuditEvent } from '$lib/utils/saleDetail';
	import { cacheLensItem } from '$lib/components/sales/catalogCache.svelte';
	import { computeSaleBreakdown } from '$lib/components/sales/detail/saleBreakdown';
	import { formatQuoteNumber } from '$lib/components/quotes/list/quoteListDisplay';
	import { formatDate } from '$lib/utils';

	let { data } = $props();
	let quote = $state<QuoteWithRelations>(untrack(() => data.quote));
	let items = $state<QuoteItemWithDetails[]>(untrack(() => data.items));
	let preview = $state<QuoteConversionPreview | null>(untrack(() => data.preview));
	let auditHistory = $state<ChangeHistoryWithUser[]>(untrack(() => data.auditHistory));

	const store = getExchangeRatesStore();
	const bcvRate = $derived(store.bcvRate);

	let showCancelModal = $state(false);
	let showConvertModal = $state(false);
	let convertForceCustomer = $state(false);
	let showEditDrawer = $state(false);
	let showAuditDrawer = $state(false);
	let expandedAuditEventId = $state<string | null>(null);
	let actionLoading = $state(false);

	let formattedQuoteNumber = $derived(formatQuoteNumber(quote.quoteNumber));
	let canAct = $derived(canOperate(data.user.role));
	let isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	let isConverted = $derived(quote.status === QuoteStatus.CONVERTED);
	let isCancelled = $derived(quote.status === QuoteStatus.CANCELLED);

	// ── Barra móvil: ResizeObserver sobre el contenedor de página (<700) ────
	let pageEl = $state<HTMLElement | undefined>(undefined);
	let isNarrow = $state(false);

	$effect(() => {
		const target = pageEl;
		if (!target) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width !== undefined) isNarrow = width < 700;
		});
		observer.observe(target);
		return () => observer.disconnect();
	});

	// ── Tabla de ítems (solo lectura, reusa SaleItemsTable) ────────────────
	const displayItems = $derived(data.items);
	const saleLikeItems = $derived(
		displayItems.map((item) => quoteItemToDisplayItem(item, quote.id))
	);
	const groups = $derived(buildQuoteDisplayGroups(displayItems, quote.id));
	// Misma fuente que ventas: respeta discountType, descuento por línea e IVA.
	const breakdown = $derived(computeSaleBreakdown(quote, displayItems));
	const subtotalNet = $derived(breakdown.subtotalNet);

	// ── Historial ─────────────────────────────────────────────────────────
	const auditEvents = $derived.by<AuditEvent[]>(() => {
		const ctx = {
			sourceQuoteNumber: data.sourceQuoteNumber,
			convertedOrderNumber: quote.convertedOrderNumber,
			quoteIsCashea: quote.isCashea,
			createdWithoutCustomer: quote.customer === null
		};
		return auditHistory
			.map((entry) =>
				classifyQuoteAuditEntry(
					{
						id: entry.id,
						action: entry.action,
						changes: (entry.changes ?? null) as never,
						changedAt: entry.changedAt,
						changedByName: entry.changedByName,
						reason: entry.reason
					},
					ctx
				)
			)
			.filter((e): e is AuditEvent => e !== null);
	});

	/** Evento de cancelación (aviso del estado cancelado). */
	const cancelledEvent = $derived(auditEvents.find((e) => e.kind === 'cancel') ?? null);

	// Catálogo de cristales → cache compartida (meta de ítems, igual que ventas).
	$effect(() => {
		for (const lens of data.lensCatalogItems) cacheLensItem(lens);
	});

	// ── Intención ?action=edit|convert (contrato action-intent-param) ──────
	let actionConsumed = false;

	$effect(() => {
		if (actionConsumed) return;
		const action = untrack(() => page.url.searchParams.get('action'));
		actionConsumed = true;
		if (!action) return;

		replaceUrlSearch(page.url, (params) => params.delete('action'));

		if (action === 'edit') {
			if (!canAct) toast.warning('No tienes permisos para editar presupuestos');
			else if (!isDraft) toast.warning('Solo se pueden editar presupuestos en borrador');
			else showEditDrawer = true;
			return;
		}
		if (action === 'convert') {
			if (!canAct) toast.warning('No tienes permisos para convertir presupuestos');
			else if (!isDraft) toast.warning('Solo se pueden convertir presupuestos en borrador');
			else {
				convertForceCustomer = quote.customer === null;
				showConvertModal = true;
			}
		}
	});

	function syncFromData() {
		const next = untrack(() => data);
		quote = next.quote;
		items = next.items;
		preview = next.preview;
		auditHistory = next.auditHistory;
	}

	async function refresh() {
		await invalidateAll();
		syncFromData();
	}

	function goBack() {
		goto(resolve('/quotes'));
	}

	function openPdfQuote() {
		window.open(resolve(`/api/pdf/quote/${quote.id}`), '_blank', 'noopener,noreferrer');
	}

	async function handleCancel() {
		actionLoading = true;
		try {
			const result = await cancelQuote({ id: quote.id });
			if (result.success) {
				toast.success('Presupuesto cancelado');
				showCancelModal = false;
				await refresh();
			} else {
				toast.error(result.error ?? 'Error cancelando presupuesto');
			}
		} catch (e) {
			logger.error('Error cancelando presupuesto', e);
			toast.error(getErrorMessage(e, 'Error cancelando presupuesto'));
		} finally {
			actionLoading = false;
		}
	}

	function openConvert(forceCustomer: boolean) {
		convertForceCustomer = forceCustomer;
		showConvertModal = true;
	}
</script>

<svelte:head>
	<title>
		Presupuesto {formattedQuoteNumber} - {quote.customer
			? `${quote.customer.firstName} ${quote.customer.lastName}`
			: 'Sin cliente'} - Optikt
	</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<div bind:this={pageEl} class="page anim-page @container w-full px-5 pt-3.5 pb-7">
		<QuoteDetailHero
			{quote}
			{items}
			{preview}
			{bcvRate}
			{canAct}
			convertedSale={data.convertedSale}
			onBack={goBack}
			onEdit={() => (showEditDrawer = true)}
			onDuplicate={() => goto(resolve(`/quotes/new?from=${quote.id}`))}
			onPrintPdf={openPdfQuote}
			onCancel={() => (showCancelModal = true)}
			onConvert={() => openConvert(quote.customer === null)}
			onAssignCustomer={() => openConvert(true)}
			onOpenHistory={() => (showAuditDrawer = true)}
		/>

		<!-- Aviso de cancelado (pill roja + motivo/fecha del historial) -->
		{#if isCancelled}
			<section
				class="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-error/30 bg-error-container/60 px-4 py-3 text-[13px] text-on-error-container"
			>
				<span class="font-bold tracking-[0.06em] uppercase">Presupuesto cancelado</span>
				{#if cancelledEvent}
					<span>
						{formatDate(cancelledEvent.changedAt, { dateStyle: 'medium', timeStyle: 'short' })}
						{#if cancelledEvent.reason}
							· {cancelledEvent.reason}
						{/if}
					</span>
				{/if}
			</section>
		{/if}

		<div
			class="mt-3 grid grid-cols-1 items-start gap-3 @min-[1060px]:grid-cols-[minmax(0,1fr)_360px]"
		>
			<div>
				{#snippet itemsHeaderBadge()}
					{#if isConverted}
						<span
							class="ml-1 inline-flex items-center gap-1 rounded bg-info-container px-1.5 py-0.5 text-[11px] font-semibold text-on-info-container"
						>
							Solo lectura · tal como se presupuestó
						</span>
					{/if}
				{/snippet}
				<SaleItemsTable
					items={saleLikeItems}
					{subtotalNet}
					allowCostEdit={false}
					bsRate={bcvRate}
					bsApproximate={true}
					{groups}
					headerBadge={itemsHeaderBadge}
				/>
			</div>

			<QuoteAuditTimeline
				events={auditEvents}
				createdByName={quote.seller?.fullName}
				createdAt={quote.createdAt}
				onViewAll={(eventId) => {
					expandedAuditEventId = eventId ?? null;
					showAuditDrawer = true;
				}}
			/>
		</div>
		<!-- Reserva 96px bajo la barra inferior fija en móvil (<700 contenedor). -->
		<div class="mobile-spacer" aria-hidden="true"></div>
	</div>
</div>

{#if isNarrow}
	<QuoteDetailMobileBar
		{quote}
		{canAct}
		onEdit={() => (showEditDrawer = true)}
		onDuplicate={() => goto(resolve(`/quotes/new?from=${quote.id}`))}
		onPrintPdf={openPdfQuote}
		onCancel={() => (showCancelModal = true)}
		onConvert={() => openConvert(quote.customer === null)}
		onOpenHistory={() => {
			showAuditDrawer = true;
		}}
	/>
{/if}

<!-- Fixed-position overlays viven FUERA del contenedor @container -->
<QuoteConvertModal
	{quote}
	open={showConvertModal}
	forceCustomerRequired={convertForceCustomer}
	onclose={() => (showConvertModal = false)}
/>

<EditSaleModal
	bind:open={showEditDrawer}
	{quote}
	quoteItems={items}
	treatments={data.allTreatments}
	onSuccess={async () => {
		await refresh();
	}}
/>

<QuoteAuditHistoryDrawer
	open={showAuditDrawer}
	events={auditEvents}
	createdBy={quote.seller?.fullName}
	createdAt={quote.createdAt}
	expandedEventId={expandedAuditEventId}
	onclose={() => {
		showAuditDrawer = false;
		expandedAuditEventId = null;
	}}
/>

<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar presupuesto"
	message="¿Está seguro que desea cancelar este presupuesto?"
	confirmLabel="Cancelar presupuesto"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>

<style>
	/* Contenedor de página: tope 1760 y contexto para todas las container
	   queries del detalle (hero + rail). Sin viewport queries para layout. */
	.page {
		max-width: 1760px;
		margin: 0 auto;
		container-type: inline-size;
	}
	.mobile-spacer {
		height: 0;
	}
	@container (max-width: 699px) {
		.mobile-spacer {
			height: 96px;
		}
	}
</style>
