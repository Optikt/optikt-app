<script lang="ts">
	import {
		ArrowLeft,
		CircleX,
		ClipboardList,
		FileText,
		Pen,
		Play,
		Printer,
		CircleCheck,
		ReceiptText,
		X
	} from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CancelSaleModal,
		EditSaleModal,
		PaymentForm,
		SaleItemsTable,
		SaleMovementsModal
	} from '$lib/components/sales';
	import { PDFViewerModal } from '$lib/components/pdf';
	import { AppBadge, ConfirmModal, SaleStatusBadge, SlideOver } from '$lib/components/ui';
	import { canOperate, canManageSaleByOwner } from '$lib/shared/enums';
	import { formatDate, formatDateOnly, formatPrice } from '$lib/utils';
	import {
		PaymentMethod,
		PAYMENT_METHOD_LABELS,
		RefundStatus,
		SaleStatus,
		UserRole,
		getSaleStatusLabel,
		isBsPaymentMethod
	} from '$lib/shared/enums';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
	import { markAsInProgress, markAsCompleted } from '$lib/remote/sales.remote';
	import { computeTaxBreakdown } from '$lib/shared/tax';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { hasHalfLetterReceiptOverflowRisk } from '$lib/utils/printDocumentItems';
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
	let drawerResetCount = $state(0);

	// Stock movements modal
	let showStockModal = $state(false);

	// PDF preview modal
	let showPdfPreview = $state(false);
	let pdfUrl = $derived(resolve(`/api/pdf/sale/${sale.id}`));

	function openStockModal() {
		showStockModal = true;
	}

	function closeStockModal() {
		showStockModal = false;
	}

	// State transition confirmations
	let showInProgressConfirm = $state(false);
	let showCompletedConfirm = $state(false);
	let transitionReason = $state('');
	let transitioning = $state(false);

	let formattedOrderNumber = $derived(`#${String(sale.orderNumber).padStart(4, '0')}`);
	let remainingBcvUsd = $derived(Math.max(0, sale.total - sale.paidAmountBcvUsd));
	let paymentProgressPercent = $derived(
		sale.total > 0 ? Math.min(100, (sale.paidAmountBcvUsd / sale.total) * 100) : 0
	);
	let canAct = $derived(canOperate(data.user.role));
	let canManageSale = $derived(canManageSaleByOwner(data.user.role, data.user.id, sale.sellerId));
	let isPending = $derived(sale.status === SaleStatus.PENDING);
	let isInProgress = $derived(sale.status === SaleStatus.IN_PROGRESS);

	let pendingFreeItemCount = $derived(
		items.filter(
			(i) =>
				i.itemType === SaleItemType.FREE_ITEM &&
				i.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.PENDING
		).length
	);
	let isCompleted = $derived(sale.status === SaleStatus.COMPLETED);
	let isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	let canPrintReceipt = $derived((isPending || isInProgress || isCompleted) && !isCancelled);
	let showPaymentForm = $derived(canAct && (isPending || isInProgress) && remainingBcvUsd > 0.01);
	let isAdmin = $derived(data.user.role === UserRole.ADMIN || data.user.role === UserRole.MANAGER);
	let receiptHalfLetterOverflowRisk = $derived(
		hasHalfLetterReceiptOverflowRisk({ itemLineCount: items.length, paymentCount: payments.length })
	);
	let lastUpdatedLabel = $derived(
		sale.updatedAt ? formatDate(sale.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) : null
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
	}

	function customerName(): string {
		if (!sale.customer) return 'Cliente no asignado';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function customerIdNumber(): string {
		return sale.customer?.idNumber ?? 'Documento no registrado';
	}

	function refundCardClasses(): string {
		if (sale.refundStatus === RefundStatus.REFUNDED) {
			return 'bg-red-50 border-red-200 text-red-800';
		}

		if (sale.refundStatus === RefundStatus.RETAINED) {
			return 'bg-amber-50 border-amber-200 text-amber-800';
		}

		return 'bg-gray-50 border-gray-200 text-gray-700';
	}

	function refundDecisionTitle(): string {
		if (sale.refundStatus === RefundStatus.REFUNDED) return 'Reembolso emitido';
		if (sale.refundStatus === RefundStatus.RETAINED) return 'Depósito retenido';
		return 'Sin pagos previos';
	}

	async function handleCancelSuccess() {
		await invalidateAll();
		syncFromData();
	}

	async function handlePaymentAdded(_newPaidAmount: number) {
		await invalidateAll();
		syncFromData();
		showDrawer = false;
	}

	function goBack() {
		goto(resolve('/sales'));
	}

	function openPdfReceipt() {
		warnIfReceiptMayExceedHalfLetter();
		window.open(resolve(`/api/pdf/sale/${sale.id}`), '_blank', 'noopener,noreferrer');
	}

	function warnIfReceiptMayExceedHalfLetter() {
		if (!receiptHalfLetterOverflowRisk) return;
		toast.warning('Este recibo tiene muchos ítems o pagos y puede superar media carta.');
	}

	async function handleMarkInProgress() {
		if (!transitionReason.trim()) return;
		transitioning = true;
		try {
			const result = await markAsInProgress({ id: sale.id, reason: transitionReason.trim() });
			if (result.success) {
				toast.success('Venta marcada como En Progreso');
				showInProgressConfirm = false;
				transitionReason = '';
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error al actualizar estado');
			}
		} catch (e) {
			console.error(e);
			toast.error('Error al marcar como En Progreso');
		} finally {
			transitioning = false;
		}
	}

	async function handleMarkCompleted() {
		if (!transitionReason.trim()) return;
		transitioning = true;
		try {
			const result = await markAsCompleted({ id: sale.id, reason: transitionReason.trim() });
			if (result.success) {
				toast.success('Venta completada');
				showCompletedConfirm = false;
				transitionReason = '';
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error al completar venta');
			}
		} catch (e) {
			console.error(e);
			toast.error('Error al completar venta');
		} finally {
			transitioning = false;
		}
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
	<title>Venta {formattedOrderNumber} - {customerName()} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<div class="mx-auto max-w-7xl px-4 py-4">
		<!-- Back link -->
		<button
			type="button"
			onclick={goBack}
			class="mb-2 flex cursor-pointer items-center gap-1.5 text-sm text-outline transition-colors hover:text-brand-blue"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a Ventas
		</button>

		<!-- Header card -->
		<div
			class="mb-4 flex flex-col items-start justify-between gap-4 rounded-[var(--ds-radius-xl)] border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-[var(--ds-shadow-md)] sm:flex-row sm:items-center"
		>
			<div>
				<p class="text-xs font-semibold tracking-widest text-on-surface-variant uppercase">
					Detalle de venta
				</p>
				<h1 class="mt-0 text-2xl font-bold text-on-surface">
					Venta {formattedOrderNumber}
				</h1>
			</div>

			<!-- Actions -->
			<div class="flex shrink-0 flex-wrap items-center gap-3">
				<!-- Grupo A: Sistema (baja jerarquía) -->
				{#if canPrintReceipt}
					<button
						type="button"
						onclick={() => (showPdfPreview = true)}
						class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant shadow-[var(--ds-shadow-md)] transition-colors hover:bg-surface-container-low"
					>
						<FileText class="h-4 w-4" />
						Ver Recibo
					</button>

					<button
						type="button"
						onclick={openPdfReceipt}
						class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant shadow-[var(--ds-shadow-md)] transition-colors hover:bg-surface-container-low"
					>
						<Printer class="h-4 w-4" />
						Imprimir PDF
					</button>
				{/if}

				<!-- Grupo B: Flujo (alta jerarquía) -->
				{#if canManageSale && (isPending || isInProgress)}
					<button
						type="button"
						onclick={() => (showEditModal = true)}
						class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-info-container px-3 py-2 text-xs font-semibold text-on-info-container shadow-[var(--ds-shadow-md)] transition-colors hover:bg-info-container"
					>
						<Pen class="h-4 w-4" />
						Editar
					</button>
				{/if}

				{#if isPending && isAdmin}
					<button
						type="button"
						onclick={() => {
							transitionReason = '';
							showInProgressConfirm = true;
						}}
						class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] bg-brand-blue px-4 py-2 text-xs font-bold text-on-primary shadow-[var(--ds-shadow-md)] transition-colors hover:bg-brand-blue-dark"
					>
						<Play class="h-4 w-4" />
						En Progreso
					</button>
				{/if}

				{#if isInProgress && canManageSale}
					<button
						type="button"
						onclick={() => {
							transitionReason = '';
							showCompletedConfirm = true;
						}}
						class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] px-4 py-2 text-xs font-bold text-on-primary shadow-[var(--ds-shadow-md)] transition-colors {remainingBcvUsd <=
						0.01
							? 'bg-success hover:bg-success/90'
							: 'bg-brand-blue hover:bg-brand-blue-dark'}"
					>
						<CircleCheck class="h-4 w-4" />
						Completar
					</button>
				{/if}

				<!-- Grupo C: Destructivo (aislado) -->
				{#if canManageSale && (isPending || isInProgress)}
					<div class="ml-4 border-l border-error-container pl-4">
						<button
							type="button"
							onclick={() => (showCancelModal = true)}
							class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--ds-radius-lg)] border border-error-container px-3 py-2 text-xs font-semibold text-on-error-container shadow-[var(--ds-shadow-md)] transition-colors hover:bg-error-container"
						>
							<CircleX class="h-4 w-4" />
							Cancelar
						</button>
					</div>
				{/if}
			</div>
		</div>

		{#if sale.notes || isCancelled}
			<div class="mb-6 grid gap-4 lg:grid-cols-2">
				{#if sale.notes}
					<section class="rounded-xl border border-gray-100/50 bg-white px-5 py-4 shadow-sm">
						<div class="flex items-start gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
							>
								<FileText class="h-5 w-5" />
							</div>
							<div>
								<p class="text-sm font-medium text-gray-500">Observaciones</p>
								<p class="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
									{sale.notes}
								</p>
							</div>
						</div>
					</section>
				{/if}

				{#if isCancelled}
					<section class="rounded-xl border p-5 shadow-sm {refundCardClasses()}">
						<div class="flex items-start gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/30">
								<CircleX class="h-5 w-5" />
							</div>
							<div class="space-y-3">
								<div>
									<p class="text-sm font-medium opacity-70">Estado de cancelación</p>
									<h2 class="mt-1.5 text-xl font-semibold text-current">{refundDecisionTitle()}</h2>
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
									<div class="rounded-xl bg-white/30 px-4 py-3 text-sm">
										<p class="text-sm font-medium opacity-70">Resolución financiera</p>
										<p class="mt-1 font-mono text-lg font-semibold text-current">
											{formatPrice(sale.refundAmount ?? 0)}
										</p>
										{#if sale.refundNotes}
											<p class="mt-1 text-sm whitespace-pre-wrap text-current/80">
												{sale.refundNotes}
											</p>
										{/if}
									</div>
								{:else if sale.refundStatus === RefundStatus.NO_PAYMENT}
									<div class="rounded-xl bg-white/30 px-4 py-3 text-sm text-current/85">
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
			<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
				<p class="text-sm font-semibold text-amber-800">
					⚠ {pendingFreeItemCount}
					{pendingFreeItemCount === 1 ? 'ítem libre pendiente' : 'ítems libres pendientes'} de completar.
				</p>
			</div>
		{/if}

		<!-- 2-column POS layout -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
			<!-- Left Column (60%) -->
			<div class="space-y-6 lg:col-span-3">
				<!-- Customer & Order Info Card -->
				<div class="rounded-xl border border-gray-100/50 bg-white p-6 shadow-sm">
					<div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
						<div>
							<p class="text-sm font-medium text-gray-500">Cliente</p>
							<p class="mt-0.5 text-base font-semibold text-gray-900">{customerName()}</p>
							<p class="text-xs text-gray-400">{customerIdNumber()}</p>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-500">Vendedor</p>
							<p class="mt-0.5 text-base font-semibold text-gray-900">
								{sale.seller?.fullName ?? 'Sin asignar'}
							</p>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-500">N° Orden</p>
							<p class="mt-0.5 text-base font-semibold text-gray-900">{formattedOrderNumber}</p>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-500">Fecha</p>
							<p class="mt-0.5 text-base font-semibold text-gray-900">
								{formatDateOnly(sale.saleDate, { dateStyle: 'medium' })}
							</p>
						</div>
						<div>
							<p class="text-sm font-medium text-gray-500">Estado</p>
							<div class="mt-0.5">
								{#if sale.status === 'IN_PROGRESS'}
									<span
										class="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-blue-700 uppercase"
									>
										{getSaleStatusLabel(sale.status)}
									</span>
								{:else}
									<SaleStatusBadge status={sale.status} />
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Items Table -->
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
			</div>

			<!-- Right Column (40%) - Sticky Mini Summary -->
			<div class="lg:sticky lg:top-6 lg:col-span-2">
				<div
					class="flex max-h-[calc(100vh-6rem)] flex-col rounded-[var(--ds-radius-xl)] border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-[var(--ds-shadow-md)]"
				>
					<div class="flex-shrink-0 space-y-3">
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-xs text-outline">Subtotal</span>
								<span class="text-xs font-semibold text-on-surface"
									>{formatPrice(sale.subtotal)}</span
								>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs text-outline">IVA ({sale.snapshotTaxRate}%)</span>
								<span class="text-xs font-semibold text-on-surface"
									>{formatPrice(taxBreakdown.taxAmount)}</span
								>
							</div>
						</div>

						<div>
							{#if remainingBcvUsd > 0.01}
								<p class="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
									Saldo Pendiente
								</p>
								<p class="mt-1 text-3xl font-extrabold text-brand-gold-dark">
									{formatPrice(remainingBcvUsd)}
								</p>
								<div class="mt-3 h-1.5 rounded-full bg-amber-100">
									<div
										class="h-full rounded-full bg-amber-400"
										style={`width: ${paymentProgressPercent}%`}
									></div>
								</div>
								<div class="mt-1 flex items-center justify-between text-[11px] text-amber-600">
									<span>{formatPrice(sale.paidAmountBcvUsd)} cubierto</span>
									<span>{paymentProgressPercent.toFixed(0)}%</span>
								</div>
							{:else}
								<p class="text-3xl font-extrabold text-success">Pagado</p>
							{/if}
						</div>

						{#if showPaymentForm}
							<button
								type="button"
								onclick={openDrawer}
								class="w-full cursor-pointer rounded-[var(--ds-radius-lg)] bg-brand-blue px-5 py-3.5 text-sm font-bold text-on-primary shadow-[var(--ds-shadow-md)] transition-colors hover:bg-brand-blue-dark"
							>
								Cobrar / Registrar Pago
							</button>
						{/if}
					</div>

					<div class="mt-3 flex min-h-0 flex-1 flex-col border-t border-outline-variant/50 pt-3">
						<p class="mb-2 text-sm font-semibold text-on-surface-variant">Abonos Registrados</p>
						<div class="min-h-0 flex-1 overflow-y-auto">
							{#if payments.length > 0}
								<div class="space-y-2">
									{#each payments as payment (payment.id)}
										<div
											class="rounded-[var(--ds-radius-lg)] border border-outline-variant bg-surface-container-low p-3"
										>
											<div class="flex items-baseline justify-between">
												<span class="text-sm font-semibold text-on-surface">
													{formatDateOnly(payment.paymentDate, { dateStyle: 'medium' })} -
													{PAYMENT_METHOD_LABELS[payment.paymentMethod as unknown as PaymentMethod]}
													{#if payment.reference}
														<span class="text-xs text-outline">(Ref. {payment.reference})</span>
													{/if}
												</span>
												<span class="text-sm font-bold text-on-surface">
													{formatPrice(payment.amountBcvUsd)}
												</span>
											</div>
											<div class="mt-1 flex items-baseline justify-between">
												{#if isBsPaymentMethod(payment.paymentMethod as unknown as PaymentMethod)}
													<span class="font-mono text-xs text-outline"
														>Tasa BCV: {Number(payment.bcvRate).toFixed(2)}</span
													>
													<span class="text-xs font-semibold text-on-surface-variant"
														>Bs. {Number(payment.amount).toLocaleString('es-VE', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2
														})}</span
													>
												{:else if (payment.paymentMethod as unknown as PaymentMethod) === PaymentMethod.BINANCE_USDT}
													<span class="font-mono text-xs text-outline"
														>Tasa USDT: {Number(payment.exchangeRate ?? 0).toFixed(2)}</span
													>
													<span class="text-xs font-semibold text-on-surface-variant"
														>USDT {Number(payment.amount).toLocaleString('es-VE', {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2
														})}</span
													>
												{:else}
													<span class="font-mono text-xs text-outline"
														>Efectivo $ • Tasa BCV: {Number(payment.bcvRate).toFixed(2)}</span
													>
													<span class="text-xs font-semibold text-on-surface-variant"
														>Bs. {Number(payment.amountBcvUsd * payment.bcvRate).toLocaleString(
															'es-VE',
															{ minimumFractionDigits: 2, maximumFractionDigits: 2 }
														)}</span
													>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="py-6 text-center text-sm text-outline italic">
									Aún no hay abonos registrados
								</p>
							{/if}
						</div>
					</div>
				</div>

				{#if isCancelled && sale.refundStatus && sale.refundStatus !== RefundStatus.NO_PAYMENT}
					<div
						class="mt-4 rounded-[var(--ds-radius-xl)] border border-outline-variant/50 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-md)]"
					>
						<p class="text-sm font-medium text-outline">{refundDecisionTitle()}</p>
						<p class="mt-1 font-mono text-2xl font-bold text-on-surface">
							{formatPrice(sale.refundAmount ?? 0)}
						</p>
					</div>
				{/if}

				<!-- Stock movements trigger -->
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

		<!-- {#if lastUpdatedLabel}
			<footer class="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400 italic">
				Última actualización registrada {lastUpdatedLabel}
			</footer>
		{/if} -->
	</div>
</div>

<SlideOver
	bind:open={showDrawer}
	onclose={() => {
		drawerResetCount++;
		closeDrawer();
	}}
	size="md"
>
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<ReceiptText class="h-5 w-5" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-semibold text-brand-navy">Registrar pago</h2>
						{#if remainingBcvUsd > 0.01}
							<AppBadge variant="info">Saldo: {formatPrice(remainingBcvUsd)}</AppBadge>
						{:else}
							<AppBadge variant="success">Pagado</AppBadge>
						{/if}
					</div>
					<p class="text-xs text-on-surface-variant">
						{sale.paidAmountBcvUsd != null && sale.paidAmountBcvUsd > 0
							? 'Pagos registrados'
							: 'Sin pagos registrados'}
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="px-6 space-y-4">
		<PaymentForm
			kind="sale"
			saleId={sale.id}
			{remainingBcvUsd}
			{bcvRate}
			isCasheaSale={sale.isCashea}
			variant="drawer"
			drawerResetKey={drawerResetCount}
			onPaymentAdded={handlePaymentAdded}
		/>
	</div>
</SlideOver>

<EditSaleModal
	bind:open={showEditModal}
	{sale}
	{items}
	products={data.allProducts}
	lensItems={data.allLensItems}
	treatments={data.allTreatments}
	onSuccess={handleEditSuccess}
/>

<CancelSaleModal
	bind:open={showCancelModal}
	saleId={sale.id}
	paidAmountBcvUsd={sale.paidAmountBcvUsd}
	onSuccess={handleCancelSuccess}
/>

<!-- Mark as In Progress confirmation -->
<ConfirmModal
	bind:open={showInProgressConfirm}
	title="Marcar como En Progreso"
	confirmLabel="Marcar En Progreso"
	confirmColor="blue"
	loading={transitioning}
	permanent={transitioning}
	confirmDisabled={!transitionReason.trim()}
	onConfirm={handleMarkInProgress}
	onCancel={() => {
		showInProgressConfirm = false;
		transitionReason = '';
	}}
>
	{#snippet body()}
		<p class="mb-3 text-sm text-gray-700">
			Va a marcar esta venta como <strong>En Progreso</strong>. Esto indica que el pedido está
			siendo procesado.
		</p>
		<label
			for="in-progress-reason"
			class="mb-1 block text-xs font-semibold tracking-wide text-slate-600 uppercase"
		>
			Motivo <span class="text-red-500">*</span>
		</label>
		<textarea
			id="in-progress-reason"
			class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
			rows="2"
			placeholder="Ej: Se envió al laboratorio..."
			bind:value={transitionReason}></textarea>
	{/snippet}
</ConfirmModal>

<!-- PDF Preview Modal -->
{#if showPdfPreview}
	<PDFViewerModal
		url={pdfUrl}
		title="Recibo de Venta {formattedOrderNumber}"
		fileName={`recibo-venta-${String(sale.orderNumber).padStart(4, '0')}.pdf`}
		onClose={() => (showPdfPreview = false)}
	/>
{/if}

<!-- Mark as Completed confirmation -->
<ConfirmModal
	bind:open={showCompletedConfirm}
	title="Completar Venta"
	confirmLabel="Completar Venta"
	confirmColor="green"
	loading={transitioning}
	permanent={transitioning}
	confirmDisabled={!transitionReason.trim()}
	onConfirm={handleMarkCompleted}
	onCancel={() => {
		showCompletedConfirm = false;
		transitionReason = '';
	}}
>
	{#snippet body()}
		<p class="mb-3 text-sm text-gray-700">
			Va a marcar esta venta como <strong>Completada</strong>. ¿Está seguro?
		</p>
		<label
			for="complete-reason"
			class="mb-1 block text-xs font-semibold tracking-wide text-slate-600 uppercase"
		>
			Motivo <span class="text-red-500">*</span>
		</label>
		<textarea
			id="complete-reason"
			class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-green-400 focus:ring-1 focus:ring-green-400"
			rows="2"
			placeholder="Ej: Cliente retiró orden..."
			bind:value={transitionReason}></textarea>
	{/snippet}
</ConfirmModal>
