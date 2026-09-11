<script lang="ts">
	import { ClipboardList } from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CancelSaleModal,
		EditSaleModal,
		SaleItemsTable,
		SaleMovementsModal,
		SaleStatusModal
	} from '$lib/components/sales';
	import { SaleAuditTimeline, SaleAuditHistoryDrawer } from '$lib/components/sales/detail';
	import SaleDetailHeader from '$lib/components/sales/detail/SaleDetailHeader.svelte';
	import SaleDetailNotices from '$lib/components/sales/detail/SaleDetailNotices.svelte';
	import SaleDetailCustomerCard from '$lib/components/sales/detail/SaleDetailCustomerCard.svelte';
	import SaleDetailSummary from '$lib/components/sales/detail/SaleDetailSummary.svelte';
	import SaleDetailPayments from '$lib/components/sales/detail/SaleDetailPayments.svelte';
	import SalePaymentDrawer from '$lib/components/sales/detail/SalePaymentDrawer.svelte';
	import { PDFViewerModal } from '$lib/components/pdf';
	import { canOperate, canManageSaleByOwner } from '$lib/shared/enums';
	import { computeDiscount, formatDate, formatPrice, getBackUrl } from '$lib/utils';
	import { getErrorMessage } from '$lib/utils/errors';
	import { RefundStatus, SaleStatus, UserRole } from '$lib/shared/enums';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
	import { computeTaxBreakdown } from '$lib/shared/tax';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { hasHalfLetterReceiptOverflowRisk } from '$lib/utils/printDocumentItems';
	import { printTickeraReceipt } from '$lib/remote/printing.remote';
	import {
		customerName,
		nextStatusTargets,
		refundDecisionTitle
	} from '$lib/components/sales/detail/saleDetail';
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
	let isCompleted = $derived(sale.status === SaleStatus.COMPLETED);
	let isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	let canPrintReceipt = $derived(
		(isPending || isInProgress || isReady || isCompleted) && !isCancelled
	);
	let showPaymentForm = $derived(canAct && !isCancelled && remainingBcvUsd > 0.01);
	let isAdmin = $derived(data.user.role === UserRole.ADMIN || data.user.role === UserRole.MANAGER);
	let receiptHalfLetterOverflowRisk = $derived(
		hasHalfLetterReceiptOverflowRisk({ itemLineCount: items.length, paymentCount: payments.length })
	);
	let lastUpdatedLabel = $derived(
		sale.updatedAt ? formatDate(sale.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) : null
	);
	let globalDiscountAmount = $derived(
		computeDiscount(sale.discount ?? 0, sale.discountType ?? 'FIXED', sale.subtotal)
	);

	const taxBreakdown = $derived(
		computeTaxBreakdown(
			items.map((i) => ({
				unitPrice: i.unitPrice,
				quantity: i.quantity,
				discount: i.discount,
				discountType: i.discountType as 'FIXED' | 'PERCENTAGE',
				isTaxable: i.snapshotIsTaxable ?? false,
				taxRate: sale.snapshotTaxRate
			}))
		)
	);

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
	<title>Venta {formattedOrderNumber} - {customerName(sale)} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<div class="mx-auto max-w-7xl px-4 py-4">
		<SaleDetailHeader
			{formattedOrderNumber}
			isCashea={sale.isCashea}
			{canPrintReceipt}
			{canManageSale}
			{isCancelled}
			{isPending}
			{isInProgress}
			{isReady}
			{isCompleted}
			{isAdmin}
			{printingTickera}
			onBack={goBack}
			onPreviewPdf={() => (showPdfPreview = true)}
			onOpenPdf={openPdfReceipt}
			onPrintTickera={printTickera}
			onChangeStatus={() => {
				statusModalPreset = undefined;
				showStatusModal = true;
			}}
			onEdit={() => (showEditModal = true)}
			onCancel={() => (showCancelModal = true)}
		/>

		<SaleDetailNotices
			notes={sale.notes}
			{isCancelled}
			refundStatus={sale.refundStatus}
			refundAmount={sale.refundAmount}
			refundNotes={sale.refundNotes}
			cancellationReason={sale.cancellationReason}
			cancelledAt={sale.cancelledAt}
			cancelledByName={sale.cancelledBy?.fullName ?? null}
			{pendingFreeItemCount}
		/>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
			<div class="space-y-6 lg:col-span-3">
				<SaleDetailCustomerCard {sale} {formattedOrderNumber} />

				<SaleItemsTable
					{items}
					subtotal={sale.subtotal}
					discount={sale.discount}
					discountType={sale.discountType}
					total={sale.total}
					allowCostEdit={canAct}
					suppliers={data.suppliers}
					onCostsUpdated={async () => {
						await invalidateAll();
						syncFromData();
					}}
				/>
			</div>

			<div class="lg:sticky lg:top-6 lg:col-span-2">
				<SaleDetailSummary
					subtotal={sale.subtotal}
					discount={sale.discount}
					discountType={sale.discountType}
					{globalDiscountAmount}
					taxRate={sale.snapshotTaxRate}
					taxAmount={taxBreakdown.taxAmount}
					total={sale.total}
					{remainingBcvUsd}
					paidAmountBcvUsd={sale.paidAmountBcvUsd}
					{paymentProgressPercent}
					{showPaymentForm}
					onPay={openDrawer}
				/>

				<SaleDetailPayments {payments} />

				<div class="mt-3">
					<SaleAuditTimeline
						{auditHistory}
						saleCreatedAt={saleLoadedAt}
						saleCreatedBy={sale.seller?.fullName}
						onViewAudit={() => (showAuditDrawer = true)}
					/>
				</div>

				{#if isCancelled && sale.refundStatus && sale.refundStatus !== RefundStatus.NO_PAYMENT}
					<div
						class="mt-4 rounded-[var(--ds-radius-xl)] border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-md)]"
					>
						<p class="text-sm font-medium text-outline">{refundDecisionTitle(sale.refundStatus)}</p>
						<p class="mt-1 font-mono text-2xl font-bold text-on-surface">
							{formatPrice(sale.refundAmount ?? 0)}
						</p>
					</div>
				{/if}

				<div class="mt-2 text-right">
					<button
						type="button"
						onclick={openStockModal}
						class="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-blue-dark"
					>
						<ClipboardList class="h-4 w-4" />
						Ver movimientos de stock ({movements.length})
					</button>
				</div>

				<SaleMovementsModal {movements} open={showStockModal} onclose={closeStockModal} />

				{#if lastUpdatedLabel}
					<div class="border-outline-variant pt-4 text-end text-sm text-on-surface-variant italic">
						Última actualización en la venta {lastUpdatedLabel}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

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

<EditSaleModal
	bind:open={showEditModal}
	{sale}
	{items}
	treatments={data.allTreatments}
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
