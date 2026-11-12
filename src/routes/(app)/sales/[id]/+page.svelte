<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CancelSaleModal,
		EditSaleModal,
		SaleMovementsModal,
		SaleStatusModal
	} from '$lib/components/sales';
	import SaleItemsTable from '$lib/components/sales/itemsTable/SaleItemsTable.svelte';
	import SaleAuditTimeline from '$lib/components/sales/detail/SaleAuditTimeline.svelte';
	import SaleAuditHistoryDrawer from '$lib/components/sales/detail/SaleAuditHistoryDrawer.svelte';
	import SaleDetailHero from '$lib/components/sales/detail/SaleDetailHero.svelte';
	import SaleDetailNotices from '$lib/components/sales/detail/SaleDetailNotices.svelte';
	import SaleDetailPayments from '$lib/components/sales/detail/SaleDetailPayments.svelte';
	import SalePaymentDrawer from '$lib/components/sales/detail/SalePaymentDrawer.svelte';
	import SaleInvoiceCalculator from '$lib/components/sales/detail/SaleInvoiceCalculator.svelte';
	import { PDFViewerModal } from '$lib/components/pdf';
	import { canOperate, canManageSaleByOwner } from '$lib/shared/enums';
	import { formatDate, getBackUrl, replaceUrlSearch } from '$lib/utils';
	import { SALE_PAID_EPSILON } from '$lib/shared/saleBalance';
	import { parseSaleAction } from '$lib/components/sales/listParams';
	import { page } from '$app/state';
	import { getErrorMessage } from '$lib/utils/errors';
	import { SaleStatus, UserRole } from '$lib/shared/enums';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import type { SalePayment } from '$lib/server/db/schema';
	import { hasHalfLetterReceiptOverflowRisk } from '$lib/utils/printDocumentItems';
	import { printTickeraReceipt } from '$lib/remote/printing.remote';
	import {
		nextStatusTargets,
		resolveSaleRateDisplay
	} from '$lib/components/sales/detail/saleDetail';
	import { computeSaleBreakdown } from '$lib/components/sales/detail/saleBreakdown';
	import { cacheLensItem } from '$lib/components/sales/catalogCache.svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';

	let { data } = $props();
	let sale = $state<SaleWithRelations>(untrack(() => data.sale));
	let items = $state<SaleItemWithDetails[]>(untrack(() => data.items));
	let payments = $state<SalePayment[]>(untrack(() => data.payments));
	let movements = $state<MovementWithDetails[]>(untrack(() => data.movements));
	const store = getExchangeRatesStore();
	const bcvRate = $derived(store.bcvRate);
	let showCancelModal = $state(false);
	let showEditModal = $state(false);

	// Drawer state
	let showDrawer = $state(false);
	let printingTickera = $state(false);
	let drawerResetCount = $state(0);

	// Stock movements modal
	let showStockModal = $state(false);

	// PDF preview modal
	let showPdfPreview = $state(false);

	// Invoice calculator drawer
	let showCalculator = $state(false);

	// Audit history drawer
	let showAuditDrawer = $state(false);
	let auditHistory = $state(untrack(() => data.auditHistory));
	/** Load instant comes from the audit create event — sale.createdAt is the business date now. */
	let saleLoadedAt = $derived(
		auditHistory.find((e) => e.entityType === 'sale' && e.action === 'create')?.changedAt ??
			sale.createdAt
	);
	let pdfUrl = $derived(resolve(`/api/pdf/sale/${sale.id}`));

	function openStockModal() {
		showStockModal = true;
	}

	function closeStockModal() {
		showStockModal = false;
	}

	// State transition
	let showStatusModal = $state(false);
	let statusModalPreset = $state<SaleStatus[] | undefined>(undefined);

	let formattedOrderNumber = $derived(`#${String(sale.orderNumber).padStart(4, '0')}`);
	let remainingBcvUsd = $derived(Math.max(0, sale.total - sale.paidAmountBcvUsd));
	let paymentProgressPercent = $derived(
		sale.total > 0 ? Math.min(100, (sale.paidAmountBcvUsd / sale.total) * 100) : 0
	);
	let canAct = $derived(canOperate(data.user.role));
	let canManageSale = $derived(canManageSaleByOwner(data.user.role, data.user.id, sale.sellerId));
	let isPending = $derived(sale.status === SaleStatus.PENDING);
	let isInProgress = $derived(sale.status === SaleStatus.IN_PROGRESS);
	let isReady = $derived(sale.status === SaleStatus.READY);
	let pendingFreeItemCount = $derived(
		items.filter(
			(i) =>
				i.itemType === SaleItemType.FREE_ITEM &&
				i.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.PENDING
		).length
	);
	let isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	let isAdmin = $derived(data.user.role === UserRole.ADMIN || data.user.role === UserRole.MANAGER);

	// ── Intención de navegación ?action=pay|status ───────────────────────────
	// Contrato: docs/specs/action-intent-param.md — se consume UNA vez, se valida
	// con los mismos guard que los botones del detalle, y se limpia la URL.
	let actionConsumed = false;

	$effect(() => {
		if (actionConsumed) return;
		const action = parseSaleAction(untrack(() => page.url.searchParams.get('action')));
		actionConsumed = true;
		if (!action) return;

		replaceUrlSearch(page.url, (params) => params.delete('action'));

		if (action === 'pay') {
			if (!canAct) {
				toast.warning('No tienes permisos para registrar pagos');
			} else if (isCancelled) {
				toast.warning('Esta venta está cancelada');
			} else if (remainingBcvUsd <= SALE_PAID_EPSILON) {
				toast.warning('Esta venta ya está pagada');
			} else {
				showDrawer = true;
			}
			return;
		}

		// 'status': mismas condiciones que el botón "Cambiar Estado" del encabezado.
		if (!canManageSale) {
			toast.warning('No tienes permisos para cambiar el estado de esta venta');
		} else if (isCancelled) {
			toast.warning('Esta venta está cancelada');
		} else if (!(
			isPending ||
			isInProgress ||
			isReady ||
			(sale.status === SaleStatus.COMPLETED && isAdmin)
		)) {
			toast.warning('Esta venta ya no permite cambiar de estado');
		} else {
			statusModalPreset = undefined;
			showStatusModal = true;
		}
	});
	let receiptHalfLetterOverflowRisk = $derived(
		hasHalfLetterReceiptOverflowRisk({ itemLineCount: items.length, paymentCount: payments.length })
	);
	let lastUpdatedLabel = $derived(
		sale.updatedAt ? formatDate(sale.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) : null
	);

	/** Single formula for the view's money display (hero desglose + items costs footer). */
	const breakdown = $derived(computeSaleBreakdown(sale, items));
	const rateDisplay = $derived(resolveSaleRateDisplay(sale.snapshotBcvRate, bcvRate));

	/** Seed the shared catalog cache so item meta shows factory treatments (drawer parity). */
	$effect(() => {
		const lenses = data.lensCatalogItems;
		for (const lens of lenses) cacheLensItem(lens);
	});

	function syncFromData() {
		const next = untrack(() => data);
		sale = next.sale;
		items = next.items;
		payments = next.payments;
		movements = next.movements;
		auditHistory = next.auditHistory;
	}

	async function handleCancelSuccess() {
		await invalidateAll();
		syncFromData();
	}

	async function handlePaymentAdded(_newPaidAmount: number) {
		await invalidateAll();
		syncFromData();
		showDrawer = false;

		// Sale just became fully paid — offer to move it forward
		// (PENDING → IN_PROGRESS/READY/COMPLETED, IN_PROGRESS → READY/COMPLETED, READY → COMPLETED).
		if (sale.paidAmountBcvUsd >= sale.total - 0.01 && (isPending || isInProgress || isReady)) {
			statusModalPreset = nextStatusTargets(sale.status) ?? undefined;
			showStatusModal = true;
		}
	}

	function goBack() {
		goto(resolve(getBackUrl('/sales') as '/sales'));
	}

	function openPdfReceipt() {
		warnIfReceiptMayExceedHalfLetter();
		window.open(resolve(`/api/pdf/sale/${sale.id}`), '_blank', 'noopener,noreferrer');
	}

	async function printTickera() {
		if (printingTickera) return;
		printingTickera = true;
		try {
			const result = await printTickeraReceipt({ saleId: sale.id });
			if (result.success) {
				toast.success(`Recibo enviado a la tickera (${result.bytes ?? ''} bytes)`);
			} else {
				toast.error(result.error ?? 'No se pudo imprimir en la tickera');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo imprimir en la tickera'));
		} finally {
			printingTickera = false;
		}
	}

	function warnIfReceiptMayExceedHalfLetter() {
		if (!receiptHalfLetterOverflowRisk) return;
		toast.warning('Este recibo tiene muchos ítems o pagos y puede superar media carta.');
	}

	async function handleStatusChanged() {
		await invalidateAll();
		syncFromData();
		statusModalPreset = undefined;
	}

	async function handleEditSuccess() {
		showEditModal = false;
		await invalidateAll();
		syncFromData();
	}

	function openDrawer() {
		showDrawer = true;
	}

	function closeDrawer() {
		showDrawer = false;
	}
</script>

<svelte:head>
	<title
		>Venta {formattedOrderNumber} - {sale.customer
			? `${sale.customer.firstName} ${sale.customer.lastName}`
			: 'Cliente no asignado'} - Optikt</title
	>
</svelte:head>

<div class="min-h-screen bg-surface">
	<div class="anim-page @container mx-auto w-full max-w-[1280px] px-5 pt-3.5 pb-7">
		<SaleDetailHero
			{sale}
			{items}
			{formattedOrderNumber}
			{bcvRate}
			{canAct}
			{canManageSale}
			{isAdmin}
			{remainingBcvUsd}
			paidAmountBcvUsd={sale.paidAmountBcvUsd}
			{paymentProgressPercent}
			{printingTickera}
			onBack={goBack}
			onChangeStatus={(target) => {
				statusModalPreset = target ? [target] : undefined;
				showStatusModal = true;
			}}
			onEdit={() => (showEditModal = true)}
			onPreviewPdf={() => (showPdfPreview = true)}
			onOpenPdf={openPdfReceipt}
			onPrintTickera={printTickera}
			onCancel={() => (showCancelModal = true)}
			onPay={openDrawer}
			onCalculate={() => (showCalculator = true)}
		/>

		<SaleDetailNotices
			{isCancelled}
			refundStatus={sale.refundStatus}
			refundAmount={sale.refundAmount}
			refundNotes={sale.refundNotes}
			cancellationReason={sale.cancellationReason}
			cancelledAt={sale.cancelledAt}
			cancelledByName={sale.cancelledBy?.fullName ?? null}
			{pendingFreeItemCount}
			{canAct}
		/>

		<div class="mt-3 grid grid-cols-1 items-start gap-3 @min-[1060px]:grid-cols-[1fr_330px]">
			<div>
				<SaleItemsTable
					{items}
					subtotalNet={breakdown.subtotalNet}
					allowCostEdit={canAct}
					suppliers={data.suppliers}
					bsRate={rateDisplay.rate}
					bsApproximate={rateDisplay.approximate}
					onCostsUpdated={async () => {
						await invalidateAll();
						syncFromData();
					}}
				/>
			</div>

			<div class="grid grid-cols-[1fr_1fr] items-start gap-3 @min-[1060px]:grid-cols-1">
				<SaleDetailPayments
					{payments}
					{canAct}
					{isCancelled}
					{remainingBcvUsd}
					onRegister={openDrawer}
					onChanged={async () => {
						await invalidateAll();
						syncFromData();
					}}
				/>

				<SaleAuditTimeline
					{auditHistory}
					saleCreatedAt={saleLoadedAt}
					saleCreatedBy={sale.seller?.fullName}
					onViewAudit={() => (showAuditDrawer = true)}
					movementsCount={movements.length}
					onOpenMovements={openStockModal}
					{lastUpdatedLabel}
				/>
			</div>
		</div>
	</div>
</div>

<!-- Fixed-position overlays live OUTSIDE the @container wrapper: container-type
     containment would make `fixed` descendants relative to the page box. -->
<SaleMovementsModal {movements} open={showStockModal} onclose={closeStockModal} />

<SalePaymentDrawer
	bind:open={showDrawer}
	saleId={sale.id}
	{remainingBcvUsd}
	{bcvRate}
	isCasheaSale={sale.isCashea}
	paidAmountBcvUsd={sale.paidAmountBcvUsd}
	drawerResetKey={drawerResetCount}
	onPaymentAdded={handlePaymentAdded}
	onClose={() => {
		drawerResetCount++;
		closeDrawer();
	}}
/>

<SaleInvoiceCalculator
	bind:open={showCalculator}
	{sale}
	{items}
	liveRate={bcvRate}
	{formattedOrderNumber}
/>

<EditSaleModal
	bind:open={showEditModal}
	{sale}
	{items}
	treatments={data.allTreatments}
	prescription={data.prescription}
	onSuccess={handleEditSuccess}
/>

<CancelSaleModal
	bind:open={showCancelModal}
	saleId={sale.id}
	paidAmountBcvUsd={sale.paidAmountBcvUsd}
	onSuccess={handleCancelSuccess}
/>

<SaleStatusModal
	bind:open={showStatusModal}
	saleId={sale.id}
	currentStatus={sale.status as SaleStatus}
	{isAdmin}
	presetTargets={statusModalPreset}
	onSuccess={handleStatusChanged}
/>

{#if showPdfPreview}
	<PDFViewerModal
		url={pdfUrl}
		title="Recibo de Venta {formattedOrderNumber}"
		fileName={`recibo-venta-${String(sale.orderNumber).padStart(4, '0')}.pdf`}
		onClose={() => (showPdfPreview = false)}
	/>
{/if}

<SaleAuditHistoryDrawer
	open={showAuditDrawer}
	onclose={() => (showAuditDrawer = false)}
	{auditHistory}
	saleCreatedAt={saleLoadedAt}
	saleCreatedBy={sale.seller?.fullName}
/>
