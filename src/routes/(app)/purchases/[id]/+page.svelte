<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { autoAnimate } from '@formkit/auto-animate';
	import {
		PurchaseOrderAsidePanel,
		PurchaseOrderDetailHeader,
		PurchaseOrderDraftBanner,
		PurchaseOrderItemsList,
		PurchaseOrderMovementsSection,
		PurchaseOrderOverviewCard
	} from '$lib/components/purchases/detail';
	import PurchaseOrderModals from '$lib/components/purchases/detail/PurchaseOrderModals.svelte';
	import PurchaseOrderDrawers from '$lib/components/purchases/detail/PurchaseOrderDrawers.svelte';
	import {
		buildPurchaseDetailSummary,
		buildRevertTarget,
		buildUnmarkReadyMessage,
		toggleItemReviewedLocal,
		type RevertTarget
	} from '$lib/components/purchases/detail/purchaseDetail';
	import { setPurchaseOrderDetailContext } from '$lib/context/purchaseOrderDetail';
	import {
		applyPriceSuggestionsCmd,
		cancelPurchaseOrderCmd,
		confirmPurchaseOrderCmd,
		markPurchaseOrderReadyCmd,
		togglePurchaseOrderItemReviewedCmd,
		unmarkPurchaseOrderReadyCmd,
		type PriceSuggestion
	} from '$lib/remote/purchaseOrders.remote';
	import { revertFullLotCmd } from '$lib/remote/inventory.remote';
	import { PurchaseOrderStatus } from '$lib/shared/enums';
	import type {
		PurchaseOrderItemWithProduct,
		PurchaseOrderWithRelations
	} from '$lib/server/db/queries/purchaseOrders';
	import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import type {
		InventoryLot,
		InventoryMovement,
		PurchaseOrderEarlyPaymentBenefit
	} from '$lib/server/db/schema';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import { getPurchaseOrderReviewStatus } from '$lib/components/purchases/purchaseOrderDraft';
	import { getErrorMessage } from '$lib/utils';
	import { tick, untrack } from 'svelte';

	let { data } = $props();
	let purchaseOrder = $state<PurchaseOrderWithRelations>(untrack(() => data.purchaseOrder));
	let items = $state<PurchaseOrderItemWithProduct[]>(untrack(() => data.items));
	let payments = $state<PurchaseOrderPaymentWithUsers[]>(untrack(() => data.payments));
	let earlyPaymentBenefits = $state<PurchaseOrderEarlyPaymentBenefit[]>(
		untrack(() => data.earlyPaymentBenefits)
	);
	let balance = $state<PurchaseOrderBalanceSummary>(untrack(() => data.balance));
	let dueStatus = $state<PurchaseOrderDueStatus>(untrack(() => data.dueStatus));
	let movements = $state<InventoryMovement[]>(untrack(() => data.movements));
	let lotsMap = $state<Record<string, InventoryLot>>(untrack(() => data.lotsMap));
	let auditHistory = $state<ChangeHistoryWithUser[]>(untrack(() => data.auditHistory));

	let actionLoading = $state(false);
	let showConfirmModal = $state(false);
	let showMarkReadyModal = $state(false);
	let showUnmarkReadyModal = $state(false);
	let showCancelModal = $state(false);
	let showConfirmAndPayModal = $state(false);
	let showPriceSuggestionModal = $state(false);
	let priceSuggestions = $state<PriceSuggestion[]>([]);
	let priceLoading = $state(false);
	let pendingPaymentComposerAmount = $state<number | null>(null);
	let paymentComposerRequest = $state<{ token: string; amount: number } | null>(null);
	let revertLoading = $state(false);
	let showRevertModal = $state(false);
	let revertTarget = $state<RevertTarget | null>(null);
	let showPaymentsDrawer = $state(false);
	let showPaymentsHistoryDrawer = $state(false);
	let showAuditHistoryDrawer = $state(false);

	function syncFromData() {
		purchaseOrder = data.purchaseOrder;
		items = data.items;
		payments = data.payments;
		earlyPaymentBenefits = data.earlyPaymentBenefits;
		balance = data.balance;
		dueStatus = data.dueStatus;
		movements = data.movements;
		lotsMap = data.lotsMap;
		auditHistory = data.auditHistory;
	}

	const formattedOrderNumber = $derived(`PO-${String(purchaseOrder.orderNumber).padStart(4, '0')}`);
	const isDraft = $derived(purchaseOrder.status === PurchaseOrderStatus.DRAFT);
	const isReadyForReview = $derived(Boolean(purchaseOrder.isReadyForReview));
	const reviewStatus = $derived(getPurchaseOrderReviewStatus(items));
	const detailSummary = $derived(buildPurchaseDetailSummary(purchaseOrder, items));
	const unmarkReadyMessage = $derived(buildUnmarkReadyMessage(reviewStatus.reviewedCount));

	setPurchaseOrderDetailContext({
		purchaseOrder: () => purchaseOrder,
		items: () => items,
		payments: () => payments,
		balance: () => balance,
		dueStatus: () => dueStatus,
		auditHistory: () => auditHistory,
		isDraft: () => isDraft,
		isReadyForReview: () => isReadyForReview,
		isConfirmed: () => isConfirmed,
		isCancelled: () => isCancelled,
		canManagePayments: () => canManagePayments,
		zeroPriceCount: () => zeroPriceCount,
		purchaseSummary: () => detailSummary.purchaseSummary,
		totalUnits: () => detailSummary.totalUnits,
		totalPurchase: () => detailSummary.totalPurchase,
		totalSale: () => detailSummary.totalSale,
		totalProfit: () => detailSummary.totalProfit,
		netTotalPurchase: () => detailSummary.netTotalPurchase,
		netTotalProfit: () => detailSummary.netTotalProfit,
		settlementDiscountAmount: () => detailSummary.settlementDiscountAmount,
		hasSettlementDiscount: () => detailSummary.hasSettlementDiscount,
		settlementDiscountLabel: () => detailSummary.settlementDiscountLabel
	});

	function openRevertModal(item: PurchaseOrderItemWithProduct) {
		const target = buildRevertTarget(item, lotsMap);
		if (!target) return;

		revertTarget = target;
		showRevertModal = true;
	}

	async function handleRevertLot() {
		if (!revertTarget) return;
		revertLoading = true;

		try {
			const result = await revertFullLotCmd({ lotId: revertTarget.lotId });
			if (result.success) {
				toast.success('Recepción del lote deshecha correctamente');
				showRevertModal = false;
				revertTarget = null;
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error deshaciendo la recepción del lote');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error deshaciendo la recepción del lote'));
		} finally {
			revertLoading = false;
		}
	}

	async function handleToggleItemReviewed(item: PurchaseOrderItemWithProduct) {
		const previous = item.isReviewed;
		const next = !previous;
		items = toggleItemReviewedLocal(items, item.id, next);
		try {
			const result = await togglePurchaseOrderItemReviewedCmd({ id: item.id, value: next });
			if (!result.success) {
				items = toggleItemReviewedLocal(items, item.id, previous);
				toast.error(result.error ?? 'Error actualizando la línea');
				return;
			}
		} catch (error) {
			items = toggleItemReviewedLocal(items, item.id, previous);
			toast.error(getErrorMessage(error, 'Error actualizando la línea'));
		}
	}

	async function handleConfirm() {
		actionLoading = true;

		try {
			const result = await confirmPurchaseOrderCmd({ id: purchaseOrder.id });
			if (result.success) {
				showConfirmModal = false;
				purchaseOrder = {
					...purchaseOrder,
					status: PurchaseOrderStatus.CONFIRMED,
					isReadyForReview: false
				};

				if (result.priceSuggestions && result.priceSuggestions.length > 0) {
					priceSuggestions = result.priceSuggestions;
					await tick();
					showPriceSuggestionModal = true;
					toast.success('Orden confirmada. Revisa las sugerencias de precio.');
				} else {
					toast.success('Orden de compra confirmada. Inventario actualizado.');
					await invalidateAll();
					syncFromData();
				}
			} else {
				toast.error(result.error ?? 'Error confirmando la orden');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error confirmando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}

	async function openPaymentComposer(amount: number) {
		paymentComposerRequest = {
			token: crypto.randomUUID(),
			amount
		};
		await tick();
		showPaymentsDrawer = true;
	}

	const isConfirmed = $derived(purchaseOrder.status === PurchaseOrderStatus.CONFIRMED);
	const isCancelled = $derived(purchaseOrder.status === PurchaseOrderStatus.CANCELLED);
	const canManagePayments = $derived(isConfirmed && !balance.isSettlementFullyPaid);
	const zeroPriceCount = $derived(
		items.filter((item) => Number(item.unitPurchasePrice || 0) === 0).length
	);

	async function maybeOpenPendingPaymentComposer() {
		if (pendingPaymentComposerAmount == null) return;

		const amount = pendingPaymentComposerAmount;
		pendingPaymentComposerAmount = null;
		await openPaymentComposer(amount);
	}

	async function handleConfirmAndPay() {
		actionLoading = true;
		const paymentAmount = detailSummary.netTotalPurchase;

		try {
			const result = await confirmPurchaseOrderCmd({ id: purchaseOrder.id });
			if (result.success) {
				showConfirmAndPayModal = false;
				purchaseOrder = {
					...purchaseOrder,
					status: PurchaseOrderStatus.CONFIRMED,
					isReadyForReview: false
				};

				if (result.priceSuggestions && result.priceSuggestions.length > 0) {
					pendingPaymentComposerAmount = paymentAmount;
					priceSuggestions = result.priceSuggestions;
					await tick();
					showPriceSuggestionModal = true;
					toast.success('Orden confirmada. Revisa las sugerencias y luego registra el pago.');
				} else {
					toast.success('Orden confirmada. Completa el pago de contado.');
					await invalidateAll();
					syncFromData();
					await openPaymentComposer(paymentAmount);
				}
			} else {
				toast.error(result.error ?? 'Error confirmando la orden');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error confirmando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleMarkReady() {
		actionLoading = true;

		try {
			const result = await markPurchaseOrderReadyCmd({ id: purchaseOrder.id, clearReviewed: true });
			if (result.success) {
				showMarkReadyModal = false;
				purchaseOrder = {
					...purchaseOrder,
					isReadyForReview: result.purchaseOrder.isReadyForReview,
					updatedAt: result.purchaseOrder.updatedAt
				};
				toast.success('Orden marcada como lista para revisar');
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error marcando la orden como lista');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error marcando orden como lista'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleUnmarkReady() {
		actionLoading = true;

		try {
			const result = await unmarkPurchaseOrderReadyCmd({ id: purchaseOrder.id });
			if (result.success) {
				showUnmarkReadyModal = false;
				purchaseOrder = {
					...purchaseOrder,
					isReadyForReview: result.purchaseOrder.isReadyForReview,
					updatedAt: result.purchaseOrder.updatedAt
				};
				toast.success('Orden devuelta a preparación');
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error devolviendo la orden a preparación');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error devolviendo orden a preparación'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleApplyPrices(updates: { productId: string; newSalePrice: number }[]) {
		priceLoading = true;

		try {
			const result = await applyPriceSuggestionsCmd({ updates });
			if (result.success) {
				toast.success(`Precios actualizados: ${result.updatedCount} producto(s)`);
				showPriceSuggestionModal = false;
				priceSuggestions = [];
				await invalidateAll();
				syncFromData();
				await maybeOpenPendingPaymentComposer();
			} else {
				toast.error(result.error ?? 'Error actualizando precios');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error actualizando precios'));
		} finally {
			priceLoading = false;
		}
	}

	async function handleSkipPrices() {
		showPriceSuggestionModal = false;
		priceSuggestions = [];
		await invalidateAll();
		syncFromData();
		await maybeOpenPendingPaymentComposer();
	}

	async function handleCancel() {
		actionLoading = true;

		try {
			const result = await cancelPurchaseOrderCmd({ id: purchaseOrder.id });
			if (result.success) {
				toast.success('Orden de compra cancelada');
				showCancelModal = false;
				purchaseOrder = {
					...purchaseOrder,
					status: PurchaseOrderStatus.CANCELLED,
					isReadyForReview: false
				};
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error cancelando la orden');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error cancelando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}

	function handleFinanceChanged(payload: {
		payments: PurchaseOrderPaymentWithUsers[];
		earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
		balance: PurchaseOrderBalanceSummary;
		dueStatus: PurchaseOrderDueStatus;
	}) {
		payments = payload.payments;
		if (payload.earlyPaymentBenefits) earlyPaymentBenefits = payload.earlyPaymentBenefits;
		balance = payload.balance;
		dueStatus = payload.dueStatus;
	}
</script>

<svelte:head>
	<title>{formattedOrderNumber} - Optikt</title>
</svelte:head>

<div class="space-y-2 p-2" use:autoAnimate>
	<!-- TODO: See if it's necessary pass all these props. Can they live inside the componente? Can they live as context? Or is needed this way? -->
	<PurchaseOrderDetailHeader
		{purchaseOrder}
		{formattedOrderNumber}
		reviewedCount={reviewStatus.reviewedCount}
		totalItems={items.length}
		allItemsReviewed={reviewStatus.allReviewed}
		{actionLoading}
		onEdit={() => goto(resolve(`/purchases/${purchaseOrder.id}/edit`))}
		onMarkReady={() => (showMarkReadyModal = true)}
		onUnmarkReady={() => (showUnmarkReadyModal = true)}
		onConfirm={() => (showConfirmModal = true)}
		onConfirmAndPay={() => (showConfirmAndPayModal = true)}
		onCancel={() => (showCancelModal = true)}
	/>

	{#if isDraft && !isReadyForReview}
		<PurchaseOrderDraftBanner />
	{/if}

	<div
		class="gap-2 space-y-2 md:grid md:grid-cols-[minmax(0,1.72fr)_minmax(17rem,0.78fr)] md:space-y-0"
	>
		<div class="space-y-2">
			<PurchaseOrderOverviewCard {purchaseOrder} />

			<PurchaseOrderItemsList
				{purchaseOrder}
				{items}
				{lotsMap}
				showReviewColumn={isDraft && isReadyForReview}
				onToggleItemReviewed={handleToggleItemReviewed}
				onRevertLot={openRevertModal}
			/>

			{#if isConfirmed && movements.length > 0}
				<PurchaseOrderMovementsSection {movements} {items} {lotsMap} />
			{/if}
		</div>

		<aside class="@container/aside space-y-2">
			<PurchaseOrderAsidePanel
				onRegisterPayment={() => (showPaymentsDrawer = true)}
				onViewPayments={() => (showPaymentsHistoryDrawer = true)}
				onViewAudit={() => (showAuditHistoryDrawer = true)}
			/>
		</aside>
	</div>
</div>

<PurchaseOrderDrawers
	bind:showPaymentsDrawer
	bind:showPaymentsHistoryDrawer
	bind:showAuditHistoryDrawer
	{purchaseOrder}
	{payments}
	{earlyPaymentBenefits}
	{balance}
	{auditHistory}
	composerRequest={paymentComposerRequest}
	onFinanceChanged={handleFinanceChanged}
/>

<PurchaseOrderModals
	bind:showConfirmModal
	bind:showConfirmAndPayModal
	bind:showMarkReadyModal
	bind:showUnmarkReadyModal
	bind:showCancelModal
	bind:showPriceSuggestionModal
	bind:showRevertModal
	{actionLoading}
	{revertLoading}
	{priceLoading}
	markReadyMessage="La orden pasará al flujo de revisión y se bloqueará la edición directa."
	{unmarkReadyMessage}
	{priceSuggestions}
	{revertTarget}
	netTotalPurchase={detailSummary.netTotalPurchase}
	onConfirm={handleConfirm}
	onConfirmAndPay={handleConfirmAndPay}
	onMarkReady={handleMarkReady}
	onUnmarkReady={handleUnmarkReady}
	onCancel={handleCancel}
	onApplyPrices={handleApplyPrices}
	onSkipPrices={handleSkipPrices}
	onRevertLot={handleRevertLot}
	onRevertCancel={() => {
		showRevertModal = false;
		revertTarget = null;
	}}
/>
