<script lang="ts">
	import {
		CircleX,
		ChevronDown,
		ChevronUp,
		FileText,
		History,
		Printer,
		Wallet
	} from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CancelSaleModal,
		PaymentForm,
		PaymentsTable,
		SaleBalanceCards,
		SaleItemsTable,
		SaleMovementsSection
	} from '$lib/components/sales';
	import { PageHeader, SaleStatusBadge } from '$lib/components/ui';
	import {
		computeSnapshotTaxBreakdown,
		getSnapshotTaxLabel
	} from '$lib/components/sales/saleItemHelpers';
	import { canOperate, canManageSaleByOwner } from '$lib/shared/enums';
	import { formatDate, formatPrice } from '$lib/utils';
	import { RefundStatus, SaleStatus } from '$lib/shared/enums';
	import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { hasHalfLetterReceiptOverflowRisk } from '$lib/utils/printDocumentItems';
	import { toast } from 'svelte-sonner';
	import { tick, untrack } from 'svelte';

	let { data } = $props();
	let sale = $state<SaleWithRelations>(untrack(() => data.sale));
	let items = $state<SaleItemWithDetails[]>(untrack(() => data.items));
	let payments = $state<SalePayment[]>(untrack(() => data.payments));
	let bcvRate = $state<number>(untrack(() => data.bcvRate));
	let movements = $state<MovementWithDetails[]>(untrack(() => data.movements));
	let showCancelModal = $state(false);
	let showPaymentComposer = $state(false);

	let formattedOrderNumber = $derived(`#${String(sale.orderNumber).padStart(4, '0')}`);
	let remainingBcvUsd = $derived(Math.max(0, sale.total - sale.paidAmountBcvUsd));
	let paymentProgressPercent = $derived(
		sale.total > 0 ? Math.min(100, (sale.paidAmountBcvUsd / sale.total) * 100) : 0
	);
	let canAct = $derived(canOperate(data.user.role));
	let canManageSale = $derived(canManageSaleByOwner(data.user.role, data.user.id, sale.sellerId));
	let isPending = $derived(sale.status === SaleStatus.PENDING);

	let pendingFreeItemCount = $derived(
		items.filter(
			(i) =>
				i.itemType === SaleItemType.FREE_ITEM &&
				i.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.PENDING
		).length
	);
	let isCompleted = $derived(sale.status === SaleStatus.COMPLETED);
	let isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	let showPaymentForm = $derived(canAct && isPending && remainingBcvUsd > 0.01);
	let receiptHalfLetterOverflowRisk = $derived(
		hasHalfLetterReceiptOverflowRisk({ itemLineCount: items.length, paymentCount: payments.length })
	);
	let taxBreakdown = $derived(computeSnapshotTaxBreakdown(items, sale.snapshotTaxRate));
	let taxLabel = $derived(getSnapshotTaxLabel(sale.snapshotTaxRate));
	let lastUpdatedLabel = $derived(
		sale.updatedAt ? formatDate(sale.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) : null
	);

	function syncFromData() {
		const next = untrack(() => data);
		sale = next.sale;
		items = next.items;
		payments = next.payments;
		bcvRate = next.bcvRate;
		movements = next.movements;
	}

	function customerName(): string {
		if (!sale.customer) return 'Cliente no asignado';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function customerIdNumber(): string {
		return sale.customer?.idNumber ?? 'Documento no registrado';
	}

	function actionButtonClasses(variant: 'neutral' | 'danger'): string {
		if (variant === 'danger') {
			return 'bg-error-container text-on-error-container hover:bg-error-container/80';
		}

		return 'bg-surface-container-low text-brand-navy hover:bg-surface-container-high';
	}

	function refundCardClasses(): string {
		if (sale.refundStatus === RefundStatus.REFUNDED) {
			return 'bg-error-container/70 text-on-error-container';
		}

		if (sale.refundStatus === RefundStatus.RETAINED) {
			return 'bg-warning-container/75 text-on-warning-container';
		}

		return 'bg-surface-container-low text-on-surface-variant';
	}

	function refundDecisionTitle(): string {
		if (sale.refundStatus === RefundStatus.REFUNDED) return 'Reembolso emitido';
		if (sale.refundStatus === RefundStatus.RETAINED) return 'Depósito retenido';
		return 'Sin pagos previos';
	}

	async function handleCancelSuccess() {
		showPaymentComposer = false;
		await invalidateAll();
		syncFromData();
	}

	async function handlePaymentAdded(_newPaidAmount: number) {
		showPaymentComposer = false;
		await invalidateAll();
		syncFromData();
	}

	async function handlePaymentVoided() {
		await invalidateAll();
		syncFromData();
	}

	function goBack() {
		goto(resolve('/sales'));
	}

	function openPrintView() {
		warnIfReceiptMayExceedHalfLetter();
		window.open(resolve(`/print/sale/${sale.id}`), '_blank', 'noopener,noreferrer');
	}

	function openPdfReceipt() {
		warnIfReceiptMayExceedHalfLetter();
		window.open(resolve(`/api/pdf/sale/${sale.id}`), '_blank', 'noopener,noreferrer');
	}

	function warnIfReceiptMayExceedHalfLetter() {
		if (!receiptHalfLetterOverflowRisk) return;
		toast.warning('Este recibo tiene muchos ítems o pagos y puede superar media carta.');
	}

	function scrollToHistory() {
		document.getElementById('sale-history')?.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
	}

	async function togglePaymentComposer(forceOpen?: boolean) {
		showPaymentComposer = forceOpen ?? !showPaymentComposer;

		if (showPaymentComposer) {
			await tick();
			document.getElementById('payment-composer')?.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}
</script>

<svelte:head>
	<title>Venta {formattedOrderNumber} - {customerName()} - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader
		title={`Venta ${formattedOrderNumber}`}
		subtitle="Detalle de venta"
		backLabel="Volver a Ventas"
		backOnClick={goBack}
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={openPrintView}
				class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
					'neutral'
				)}"
			>
				<FileText class="h-4 w-4" />
				Ver recibo
			</button>

			<button
				type="button"
				onclick={openPdfReceipt}
				class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
					'neutral'
				)}"
			>
				<Printer class="h-4 w-4" />
				Imprimir PDF
			</button>

			<button
				type="button"
				onclick={scrollToHistory}
				class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
					'neutral'
				)}"
			>
				<History class="h-4 w-4" />
				Ver historial
			</button>

			{#if canManageSale && isPending}
				<button
					type="button"
					onclick={() => (showCancelModal = true)}
					class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
						'danger'
					)}"
				>
					<CircleX class="h-4 w-4" />
					Cancelar venta
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="-mt-2 flex flex-wrap items-center gap-3 text-on-surface-variant">
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Orden</span>
			<span class="font-mono text-sm font-semibold text-brand-navy">{formattedOrderNumber}</span>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Cliente</span>
			<span class="font-semibold text-brand-navy">{customerName()}</span>
			<span class="font-mono text-sm text-outline">{customerIdNumber()}</span>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Fecha</span>
			<span class="font-semibold text-brand-navy"
				>{formatDate(sale.saleDate, { dateStyle: 'medium' })}</span
			>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Vendedor</span>
			<span class="font-semibold text-brand-navy">{sale.seller?.fullName ?? 'Sin asignar'}</span>
		</div>
		<div class="inline-flex items-center rounded-xl bg-surface-container-low px-3 py-2 shadow-sm">
			<SaleStatusBadge status={sale.status} />
		</div>
	</div>

	{#if sale.notes || isCancelled}
		<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.95fr)]">
			{#if sale.notes}
				<section class="rounded-[1.5rem] bg-surface-container-low p-6">
					<div class="flex items-start gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-info-container text-on-info-container"
						>
							<FileText class="h-5 w-5" />
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
								Observaciones
							</p>
							<p class="mt-2 text-base leading-relaxed text-on-surface">{sale.notes}</p>
						</div>
					</div>
				</section>
			{/if}

			{#if isCancelled}
				<section class="rounded-[1.5rem] p-6 {refundCardClasses()}">
					<div class="flex items-start gap-3">
						<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/30">
							<CircleX class="h-5 w-5" />
						</div>
						<div class="space-y-3">
							<div>
								<p class="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-70">
									Estado de cancelación
								</p>
								<h2 class="mt-2 text-2xl font-semibold text-current">{refundDecisionTitle()}</h2>
								<p class="mt-1 text-sm leading-relaxed text-current/80">
									{sale.cancellationReason ?? 'Sin motivo registrado'}
								</p>
							</div>

							<div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-current/85">
								{#if sale.cancelledAt}
									<span
										>{formatDate(sale.cancelledAt, {
											dateStyle: 'medium',
											timeStyle: 'short'
										})}</span
									>
								{/if}
								{#if sale.cancelledBy}
									<span>Por: {sale.cancelledBy.fullName}</span>
								{/if}
							</div>

							{#if sale.refundStatus && sale.refundStatus !== RefundStatus.NO_PAYMENT}
								<div class="rounded-2xl bg-white/30 px-4 py-3 text-sm">
									<p class="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-70">
										Resolución financiera
									</p>
									<p class="mt-1 font-mono text-lg font-semibold text-current">
										{formatPrice(sale.refundAmount ?? 0)}
									</p>
									{#if sale.refundNotes}
										<p class="mt-1 text-sm text-current/80">{sale.refundNotes}</p>
									{/if}
								</div>
							{:else if sale.refundStatus === RefundStatus.NO_PAYMENT}
								<div class="rounded-2xl bg-white/30 px-4 py-3 text-sm text-current/85">
									Sin pagos previos, no aplica reembolso.
								</div>
							{/if}
						</div>
					</div>
				</section>
			{/if}
		</div>
	{/if}

	{#if pendingFreeItemCount > 0}
		<div class="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4">
			<p class="text-sm font-semibold text-amber-800">
				⚠ Esta venta tiene {pendingFreeItemCount}
				{pendingFreeItemCount === 1 ? 'ítem libre pendiente' : 'ítems libres pendientes'} de completar.
			</p>
			<p class="mt-1 text-xs text-amber-700">
				Los reportes de margen estarán incompletos hasta que se registren los costos.
			</p>
		</div>
	{/if}

	<SaleItemsTable
		{items}
		subtotal={sale.subtotal}
		allowCostEdit={canAct}
		suppliers={data.suppliers}
		onCostsUpdated={async () => {
			await invalidateAll();
			syncFromData();
		}}
	/>

	<SaleBalanceCards
		subtotal={sale.subtotal}
		total={sale.total}
		discountType={sale.discountType}
		discount={sale.discount}
		paidAmountBcvUsd={sale.paidAmountBcvUsd}
		{remainingBcvUsd}
		{paymentProgressPercent}
		paymentsCount={payments.length}
		{taxBreakdown}
		{taxLabel}
		{isCancelled}
		{isCompleted}
		refundStatus={sale.refundStatus}
		refundAmount={sale.refundAmount}
		refundDecisionTitle={refundDecisionTitle()}
	/>

	<section id="sale-history" class="space-y-4" use:autoAnimate>
		<div class="glass-card overflow-hidden">
			<div
				class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
					>
						<Wallet class="h-5 w-5" />
					</div>
					<div>
						<h2 class="text-xl font-semibold text-brand-navy">Historial de pagos</h2>
						<p class="text-sm text-on-surface-variant">
							Registro cronológico de abonos y anulaciones.
						</p>
					</div>
				</div>
			</div>

			<div class="px-6 pb-6">
				<PaymentsTable
					{payments}
					saleId={sale.id}
					allowVoid={canManageSale && isPending}
					onPaymentVoided={handlePaymentVoided}
				/>
			</div>
		</div>

		{#if showPaymentForm}
			<section class="glass-card overflow-hidden">
				<div
					class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 lg:flex-row lg:items-start lg:justify-between"
				>
					<div>
						<h2 class="text-xl font-semibold text-brand-navy">Registrar pago</h2>
						<p class="mt-1 max-w-2xl text-sm text-on-surface-variant">
							Selecciona el método y edita cualquiera de los dos montos; el otro se recalcula
							automáticamente.
						</p>
					</div>

					<div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
						<div
							class="rounded-xl px-4 py-3 text-sm {remainingBcvUsd > 0.01
								? 'bg-brand-navy text-white'
								: 'bg-success-container text-on-success-container'}"
						>
							<p
								class="text-xs font-semibold tracking-[0.14em] uppercase {remainingBcvUsd > 0.01
									? 'text-white/68'
									: 'text-on-success-container/70'}"
							>
								Pendiente actual
							</p>
							<p class="mt-1 font-mono text-xl font-semibold">
								{formatPrice(remainingBcvUsd)}
							</p>
						</div>
						<button
							type="button"
							onclick={() => togglePaymentComposer()}
							class="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition-colors hover:bg-brand-gold-dark"
						>
							{#if showPaymentComposer}
								<ChevronUp class="h-4 w-4" />
								Ocultar formulario
							{:else}
								<ChevronDown class="h-4 w-4" />
								Registrar abono
							{/if}
						</button>
					</div>
				</div>

				{#if showPaymentComposer}
					<div class="px-6 pt-6 pb-6">
						<div id="payment-composer" class="rounded-[1.5rem] bg-surface-container-lowest p-5">
							<PaymentForm
								saleId={sale.id}
								{remainingBcvUsd}
								{bcvRate}
								onPaymentAdded={handlePaymentAdded}
							/>
						</div>
					</div>
				{/if}
			</section>
		{/if}
	</section>

	<SaleMovementsSection {movements} />

	{#if lastUpdatedLabel}
		<footer class="border-t border-surface-container-high pt-6 text-sm text-outline italic">
			Última actualización registrada {lastUpdatedLabel}
		</footer>
	{/if}
</div>

<CancelSaleModal
	bind:open={showCancelModal}
	saleId={sale.id}
	paidAmountBcvUsd={sale.paidAmountBcvUsd}
	onSuccess={handleCancelSuccess}
/>
