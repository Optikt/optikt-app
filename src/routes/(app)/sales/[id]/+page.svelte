<script lang="ts">
	import {
		CircleX,
		FileText,
		History,
		Pen,
		Play,
		Printer,
		CheckCircle2,
		Wallet
	} from '@lucide/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CancelSaleModal,
		EditSaleModal,
		PaymentForm,
		PaymentsTable,
		SaleItemsTable,
		SaleMovementsSection
	} from '$lib/components/sales';
	import { ConfirmModal, PageHeader, SaleStatusBadge } from '$lib/components/ui';
	import { canOperate, canManageSaleByOwner } from '$lib/shared/enums';
	import { formatDate, formatDateOnly, formatPrice } from '$lib/utils';
	import { RefundStatus, SaleStatus, UserRole, getSaleStatusLabel } from '$lib/shared/enums';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
	import { markAsInProgress, markAsCompleted } from '$lib/remote/sales.remote';
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
		await invalidateAll();
		syncFromData();
	}

	async function handlePaymentAdded(_newPaidAmount: number) {
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
</script>

<svelte:head>
	<title>Venta {formattedOrderNumber} - {customerName()} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-gray-100">
	<div class="mx-auto max-w-7xl px-8 py-8">
		<PageHeader
			title={`Venta ${formattedOrderNumber}`}
			subtitle="Detalle de venta"
			backLabel="Volver a Ventas"
			backOnClick={goBack}
		>
			{#snippet actions()}
				{#if canPrintReceipt}
					<button
						type="button"
						onclick={openPrintView}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-gray-50"
					>
						<FileText class="h-4 w-4" />
						Ver recibo
					</button>

					<button
						type="button"
						onclick={openPdfReceipt}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-gray-50"
					>
						<Printer class="h-4 w-4" />
						Imprimir PDF
					</button>
				{/if}

				<button
					type="button"
					onclick={scrollToHistory}
					class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-gray-50"
				>
					<History class="h-4 w-4" />
					Historial
				</button>

				{#if canManageSale && (isPending || isInProgress)}
					<button
						type="button"
						onclick={() => (showEditModal = true)}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-gray-50"
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
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-gray-50"
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
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-gray-50"
					>
						<CheckCircle2 class="h-4 w-4" />
						Completar
					</button>
				{/if}

				{#if canManageSale && (isPending || isInProgress)}
					<button
						type="button"
						onclick={() => (showCancelModal = true)}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-red-600 uppercase shadow-sm transition-colors hover:bg-red-100"
					>
						<CircleX class="h-4 w-4" />
						Cancelar
					</button>
				{/if}
			{/snippet}
		</PageHeader>

		<!-- Info chips row -->
		<div class="-mt-1 mb-6 flex flex-wrap items-center gap-2">
			<div class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
				<span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Orden</span>
				<span class="font-mono text-sm font-semibold text-gray-900">{formattedOrderNumber}</span>
			</div>
			<div class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
				<span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Cliente</span
				>
				<span class="text-sm font-semibold text-gray-900">{customerName()}</span>
				<span class="font-mono text-xs text-gray-400">{customerIdNumber()}</span>
			</div>
			<div class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
				<span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Fecha</span>
				<span class="text-sm font-semibold text-gray-900"
					>{formatDateOnly(sale.saleDate, { dateStyle: 'medium' })}</span
				>
			</div>
			<div class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
				<span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase"
					>Vendedor</span
				>
				<span class="text-sm font-semibold text-gray-900"
					>{sale.seller?.fullName ?? 'Sin asignar'}</span
				>
			</div>
			<div class="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-sm">
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

		{#if sale.notes || isCancelled}
			<div class="mb-6 grid gap-4 lg:grid-cols-2">
				{#if sale.notes}
					<section class="rounded-xl bg-white px-5 py-4 shadow-sm">
						<div class="flex items-start gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"
							>
								<FileText class="h-5 w-5" />
							</div>
							<div>
								<p class="text-[11px] font-semibold tracking-[0.14em] text-gray-400 uppercase">
									Observaciones
								</p>
								<p class="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
									{sale.notes}
								</p>
							</div>
						</div>
					</section>
				{/if}

				{#if isCancelled}
					<section class="rounded-xl p-5 shadow-sm {refundCardClasses()}">
						<div class="flex items-start gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/30">
								<CircleX class="h-5 w-5" />
							</div>
							<div class="space-y-3">
								<div>
									<p class="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-70">
										Estado de cancelación
									</p>
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
										<p class="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-70">
											Resolución financiera
										</p>
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

		<!-- Grid: right column first for mobile -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<!-- Right column (first DOM → on top on mobile, right on desktop) -->
			<div
				class="space-y-6 lg:sticky lg:top-8 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:self-start"
			>
				<div class="rounded-xl bg-white p-6 shadow-sm">
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-xs text-gray-400">Total deuda</span>
							<span class="font-mono text-lg font-bold text-gray-900"
								>{formatPrice(sale.total)}</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-xs text-gray-400">Total pagado</span>
							<span class="font-mono text-lg font-bold text-emerald-600"
								>{formatPrice(sale.paidAmountBcvUsd)}</span
							>
						</div>
						<div class="border-t border-gray-100 pt-4">
							<p class="mb-1 text-xs font-semibold tracking-wider text-gray-400 uppercase">
								Saldo pendiente
							</p>
							<p class="font-mono text-4xl font-bold text-amber-600">
								{formatPrice(remainingBcvUsd)}
							</p>
						</div>
						{#if remainingBcvUsd > 0.01}
							<div class="h-1.5 rounded-full bg-amber-100">
								<div
									class="h-full rounded-full bg-amber-400"
									style={`width: ${paymentProgressPercent}%`}
								></div>
							</div>
							<div class="flex items-center justify-between text-[11px] text-amber-600">
								<span>{formatPrice(sale.paidAmountBcvUsd)} cubierto</span>
								<span>{paymentProgressPercent.toFixed(0)}%</span>
							</div>
						{/if}
						{#if isCancelled && sale.refundStatus && sale.refundStatus !== RefundStatus.NO_PAYMENT}
							<p class="text-xs text-gray-500">
								{refundDecisionTitle()} por
								<span class="font-mono font-semibold">{formatPrice(sale.refundAmount ?? 0)}</span>
							</p>
						{/if}
					</div>
				</div>

				{#if showPaymentForm}
					<div class="rounded-xl bg-white p-6 shadow-sm">
						<PaymentForm
							saleId={sale.id}
							{remainingBcvUsd}
							{bcvRate}
							onPaymentAdded={handlePaymentAdded}
						/>
					</div>
				{/if}
			</div>

			<!-- Left column (second DOM → below on mobile, left on desktop) -->
			<div class="space-y-6 lg:col-span-2 lg:col-start-1 lg:row-start-1">
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

				<section id="sale-history">
					<div class="rounded-xl bg-white shadow-sm">
						<div
							class="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
						>
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-brand-navy"
								>
									<Wallet class="h-5 w-5" />
								</div>
								<div>
									<h2 class="text-base font-semibold text-gray-900">Historial de pagos</h2>
									<p class="text-xs text-gray-500">Registro cronológico de abonos y anulaciones.</p>
								</div>
							</div>
						</div>

						<div class="px-5 pb-5">
							<PaymentsTable
								{payments}
								saleId={sale.id}
								allowVoid={canManageSale && (isPending || isInProgress)}
								onPaymentVoided={handlePaymentVoided}
							/>
						</div>
					</div>
				</section>

				<SaleMovementsSection {movements} />
			</div>
		</div>

		{#if lastUpdatedLabel}
			<footer class="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400 italic">
				Última actualización registrada {lastUpdatedLabel}
			</footer>
		{/if}
	</div>
</div>

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
			bind:value={transitionReason}
		></textarea>
	{/snippet}
</ConfirmModal>

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
			bind:value={transitionReason}
		></textarea>
	{/snippet}
</ConfirmModal>
