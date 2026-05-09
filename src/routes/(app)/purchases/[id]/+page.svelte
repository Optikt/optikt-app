<script lang="ts">
	import {
		ArrowRightLeft,
		Calendar,
		CheckCircle,
		CircleCheck,
		ClipboardCheck,
		Pencil,
		FileText,
		Hash,
		Package,
		RotateCcw,
		ScrollText,
		Search,
		Truck,
		XCircle
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PriceSuggestionModal } from '$lib/components/purchases';
	import { AppBadge, ConfirmModal, PageHeader, PurchaseOrderStatusBadge } from '$lib/components/ui';
	import { revertFullLotCmd } from '$lib/remote/inventory.remote';
	import {
		applyPriceSuggestionsCmd,
		cancelPurchaseOrderCmd,
		confirmPurchaseOrderCmd,
		markPurchaseOrderReadyCmd,
		togglePurchaseOrderItemReviewedCmd,
		unmarkPurchaseOrderReadyCmd,
		type PriceSuggestion
	} from '$lib/remote/purchaseOrders.remote';
	import {
		getInventoryMovementTypeLabel,
		getPurchaseDocumentTypeLabel,
		getPurchaseOrderItemTypeLabel,
		PurchaseDocumentType,
		PurchaseOrderStatus
	} from '$lib/shared/enums';
	import type {
		PurchaseOrderItemWithProduct,
		PurchaseOrderWithRelations
	} from '$lib/server/db/queries/purchaseOrders';
	import { getPurchaseOrderReviewStatus } from '$lib/components/purchases/purchaseOrderDraft';
	import type { InventoryLot, InventoryMovement } from '$lib/server/db/schema';
	import { formatDate, formatPrice, getErrorMessage } from '$lib/utils';
	import { tick, untrack } from 'svelte';

	let { data } = $props();
	let purchaseOrder = $state<PurchaseOrderWithRelations>(untrack(() => data.purchaseOrder));
	let items = $state<PurchaseOrderItemWithProduct[]>(untrack(() => data.items));
	let movements = $state<InventoryMovement[]>(untrack(() => data.movements));
	let lotsMap = $state<Record<string, InventoryLot>>(untrack(() => data.lotsMap));

	let actionLoading = $state(false);
	let showConfirmModal = $state(false);
	let showMarkReadyModal = $state(false);
	let showUnmarkReadyModal = $state(false);
	let showCancelModal = $state(false);
	let showPriceSuggestionModal = $state(false);
	let priceSuggestions = $state<PriceSuggestion[]>([]);
	let priceLoading = $state(false);
	let revertLoading = $state(false);
	let showRevertModal = $state(false);
	let revertTarget = $state<{ lotId: string; productName: string; quantity: number } | null>(null);

	type ItemReviewFilter = 'all' | 'reviewed' | 'pending';
	let itemSearch = $state('');
	let itemReviewFilter = $state<ItemReviewFilter>('all');

	const itemReviewFilterOptions: { value: ItemReviewFilter; label: string }[] = [
		{ value: 'all', label: 'Todas' },
		{ value: 'pending', label: 'Sin revisar' },
		{ value: 'reviewed', label: 'Revisadas' }
	];

	function syncFromData() {
		purchaseOrder = data.purchaseOrder;
		items = data.items;
		movements = data.movements;
		lotsMap = data.lotsMap;
	}

	const formattedOrderNumber = $derived(`PO-${String(purchaseOrder.orderNumber).padStart(4, '0')}`);
	const isDraft = $derived(purchaseOrder.status === PurchaseOrderStatus.DRAFT);
	const isReadyForReview = $derived(Boolean(purchaseOrder.isReadyForReview));
	const isConfirmed = $derived(purchaseOrder.status === PurchaseOrderStatus.CONFIRMED);
	const detailSubtitle = $derived.by(() => {
		if (purchaseOrder.status === PurchaseOrderStatus.DRAFT) {
			return purchaseOrder.isReadyForReview
				? 'Listo para revisar y confirmar inventario'
				: 'Borrador en preparación, sin impacto en inventario';
		}

		if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
			return 'Orden cancelada y cerrada para nuevas acciones';
		}

		return 'Revisión de detalles y movimientos de inventario';
	});
	const totalUnits = $derived(items.reduce((sum, item) => sum + item.quantity, 0));
	const reviewStatus = $derived(getPurchaseOrderReviewStatus(items));
	const reviewedCount = $derived(reviewStatus.reviewedCount);
	const allItemsReviewed = $derived(reviewStatus.allReviewed);
	const hasReviewedChecks = $derived(reviewedCount > 0);
	const showReviewColumn = $derived(isDraft && isReadyForReview);
	const filteredItems = $derived.by(() => {
		const term = itemSearch.trim().toLowerCase();
		const matches = items.filter((item) => {
			if (itemReviewFilter === 'reviewed' && !item.isReviewed) return false;
			if (itemReviewFilter === 'pending' && item.isReviewed) return false;
			if (!term) return true;
			const haystack = [
				item.product?.name,
				item.product?.sku,
				item.product?.personalCode,
				item.lensCatalogItem?.name,
				item.lensCatalogItem?.type
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return haystack.includes(term);
		});
		return matches.slice().sort((a, b) => {
			const codeA = a.product?.personalCode?.trim() ?? '';
			const codeB = b.product?.personalCode?.trim() ?? '';
			if (codeA && !codeB) return -1;
			if (!codeA && codeB) return 1;
			if (codeA && codeB) {
				const diff = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
				if (diff !== 0) return diff;
			}
			return itemDisplayName(a).localeCompare(itemDisplayName(b), 'es', { sensitivity: 'base' });
		});
	});
	const hasItemFilters = $derived(itemSearch.trim().length > 0 || itemReviewFilter !== 'all');
	const totalPurchase = $derived(
		items.reduce((sum, item) => sum + item.unitPurchasePrice * item.quantity, 0)
	);
	const totalSale = $derived(
		items.reduce((sum, item) => sum + item.unitSalePrice * item.quantity, 0)
	);
	const totalProfit = $derived(totalSale - totalPurchase);
	const documentLabel = $derived(getPurchaseDocumentTypeLabel(purchaseOrder.documentType));
	const documentNumber = $derived.by(() => {
		if (purchaseOrder.documentType === PurchaseDocumentType.DELIVERY_NOTE) {
			return purchaseOrder.deliveryNoteNumber || '--';
		}

		return purchaseOrder.invoiceNumber || '--';
	});
	const supplementalDeliveryNoteNumber = $derived(
		purchaseOrder.documentType === PurchaseDocumentType.DELIVERY_NOTE
			? null
			: purchaseOrder.deliveryNoteNumber || null
	);
	const markReadyMessage = $derived(
		hasReviewedChecks
			? `Hay ${reviewedCount} línea(s) marcadas como revisadas. Puedes conservar esos checks o limpiarlos para empezar la revisión desde cero.`
			: 'La orden pasará al flujo de revisión y se bloqueará la edición directa.'
	);
	const unmarkReadyMessage = $derived(
		hasReviewedChecks
			? `La orden volverá a preparación para poder editarla. Hay ${reviewedCount} línea(s) con checks de revisión; puedes conservarlos porque ya fueron confirmados o limpiarlos ahora.`
			: 'La orden volverá a preparación para poder editarla.'
	);
	const markReadyConfirmLabel = $derived(
		hasReviewedChecks ? 'Conservar checks y marcar lista' : 'Marcar lista'
	);
	const unmarkReadyConfirmLabel = $derived(
		hasReviewedChecks ? 'Conservar checks y volver' : 'Volver a borrador'
	);
	const markReadySecondaryLabel = $derived(
		hasReviewedChecks ? 'Quitar checks y marcar lista' : undefined
	);
	const unmarkReadySecondaryLabel = $derived(
		hasReviewedChecks ? 'Quitar checks y volver' : undefined
	);

	function goBack() {
		goto(resolve('/purchases'));
	}

	function scrollToMovements() {
		document.getElementById('purchase-movements')?.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
	}

	function openEdit() {
		void goto(resolve(`/purchases/${purchaseOrder.id}/edit`));
	}

	function formatBcvRate(rate: number): string {
		return `${new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(rate)} VES`;
	}

	function actionButtonClasses(variant: 'neutral' | 'success' | 'danger'): string {
		if (variant === 'success') {
			return 'bg-success-container text-on-success-container hover:bg-success-container/80';
		}

		if (variant === 'danger') {
			return 'bg-error-container text-on-error-container hover:bg-error-container/80';
		}

		return 'bg-surface-container-low text-brand-navy hover:bg-surface-container-high';
	}

	function itemDisplayName(item: PurchaseOrderItemWithProduct): string {
		return item.product?.name ?? item.lensCatalogItem?.name ?? 'Ítem no disponible';
	}

	function itemDisplayMeta(item: PurchaseOrderItemWithProduct): string {
		if (item.product?.sku) return item.product.sku;
		if (item.lensCatalogItem?.type) return item.lensCatalogItem.type;
		return getPurchaseOrderItemTypeLabel(item.itemType);
	}

	function itemBadgeVariant(item: PurchaseOrderItemWithProduct): 'neutral' | 'info' {
		return item.lensCatalogItem ? 'info' : 'neutral';
	}

	function lotForItem(item: PurchaseOrderItemWithProduct): InventoryLot | null {
		return item.lotId ? (lotsMap[item.lotId] ?? null) : null;
	}

	function formatLotCode(lotId: string | null): string {
		if (!lotId) return 'Sin lote';
		const lot = lotsMap[lotId];
		if (!lot) return 'Sin lote';
		return `L-${String(lot.lotNumber).padStart(4, '0')}`;
	}

	function purchaseLineTotal(item: PurchaseOrderItemWithProduct): number {
		return item.unitPurchasePrice * item.quantity;
	}

	function movementItemName(movement: InventoryMovement): string {
		const item = items.find((entry) => entry.lotId === movement.lotId);
		return item ? itemDisplayName(item) : 'Ítem relacionado';
	}

	function movementDescription(movement: InventoryMovement): string {
		if (movement.notes) return movement.notes;

		const lotLabel = formatLotCode(movement.lotId);
		const itemName = movementItemName(movement);
		const prefix = movement.quantityDelta > 0 ? 'Entrada registrada' : 'Ajuste registrado';
		return `${prefix} para ${itemName} (${lotLabel}).`;
	}

	function canRevertLot(item: PurchaseOrderItemWithProduct): boolean {
		const lot = lotForItem(item);
		return lot ? lot.quantityAvailable === lot.quantityInitial : false;
	}

	function openRevertModal(item: PurchaseOrderItemWithProduct) {
		if (!item.lotId) return;
		const lot = lotsMap[item.lotId];
		if (!lot) return;

		revertTarget = {
			lotId: item.lotId,
			productName: itemDisplayName(item),
			quantity: lot.quantityInitial
		};
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
			console.error(error);
			toast.error(getErrorMessage(error, 'Error deshaciendo la recepción del lote'));
		} finally {
			revertLoading = false;
		}
	}

	async function handleToggleItemReviewed(item: PurchaseOrderItemWithProduct) {
		const previous = item.isReviewed;
		const next = !previous;
		items = items.map((entry) => (entry.id === item.id ? { ...entry, isReviewed: next } : entry));
		try {
			const result = await togglePurchaseOrderItemReviewedCmd({ id: item.id, value: next });
			if (!result.success) {
				items = items.map((entry) =>
					entry.id === item.id ? { ...entry, isReviewed: previous } : entry
				);
				toast.error(result.error ?? 'Error actualizando la línea');
				return;
			}
		} catch (error) {
			items = items.map((entry) =>
				entry.id === item.id ? { ...entry, isReviewed: previous } : entry
			);
			console.error(error);
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
			console.error(error);
			toast.error(getErrorMessage(error, 'Error confirmando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleMarkReady(clearReviewed: boolean = false) {
		actionLoading = true;

		try {
			const result = await markPurchaseOrderReadyCmd({ id: purchaseOrder.id, clearReviewed });
			if (result.success) {
				showMarkReadyModal = false;
				purchaseOrder = {
					...purchaseOrder,
					isReadyForReview: result.purchaseOrder.isReadyForReview,
					updatedAt: result.purchaseOrder.updatedAt
				};
				toast.success(
					clearReviewed
						? 'Orden marcada como lista para revisar. Checks limpiados.'
						: 'Orden marcada como lista para revisar'
				);
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error marcando la orden como lista');
			}
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error marcando orden como lista'));
		} finally {
			actionLoading = false;
		}
	}

	async function handleUnmarkReady(clearReviewed: boolean = false) {
		actionLoading = true;

		try {
			const result = await unmarkPurchaseOrderReadyCmd({ id: purchaseOrder.id, clearReviewed });
			if (result.success) {
				showUnmarkReadyModal = false;
				purchaseOrder = {
					...purchaseOrder,
					isReadyForReview: result.purchaseOrder.isReadyForReview,
					updatedAt: result.purchaseOrder.updatedAt
				};
				toast.success(
					clearReviewed
						? 'Orden devuelta a preparación. Checks limpiados.'
						: 'Orden devuelta a preparación'
				);
				await invalidateAll();
				syncFromData();
			} else {
				toast.error(result.error ?? 'Error devolviendo la orden a preparación');
			}
		} catch (error) {
			console.error(error);
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
			} else {
				toast.error(result.error ?? 'Error actualizando precios');
			}
		} catch (error) {
			console.error(error);
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
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cancelando orden de compra'));
		} finally {
			actionLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{formattedOrderNumber} - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader
		title={formattedOrderNumber}
		subtitle={detailSubtitle}
		backLabel="Volver a órdenes"
		backOnClick={goBack}
	>
		{#snippet actions()}
			{#if isConfirmed && movements.length > 0}
				<button
					type="button"
					onclick={scrollToMovements}
					class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
						'neutral'
					)}"
				>
					<ArrowRightLeft class="h-4 w-4" />
					Ver movimientos
				</button>
			{/if}

			{#if isDraft}
				{#if !isReadyForReview}
					<button
						type="button"
						onclick={openEdit}
						disabled={actionLoading}
						class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 {actionButtonClasses(
							'neutral'
						)}"
					>
						<Pencil class="h-4 w-4" />
						Editar
					</button>
				{/if}
				{#if isReadyForReview}
					<button
						type="button"
						onclick={() => (showUnmarkReadyModal = true)}
						disabled={actionLoading}
						class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 {actionButtonClasses(
							'neutral'
						)}"
					>
						<RotateCcw class="h-4 w-4" />
						Volver a edición
					</button>
				{:else}
					<button
						type="button"
						onclick={() => (showMarkReadyModal = true)}
						disabled={actionLoading}
						class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 {actionButtonClasses(
							'neutral'
						)}"
					>
						<ClipboardCheck class="h-4 w-4" />
						Marcar listo
					</button>
				{/if}
				{#if isReadyForReview}
					<button
						type="button"
						onclick={() => (showConfirmModal = true)}
						disabled={actionLoading || !allItemsReviewed}
						title={allItemsReviewed
							? 'Confirmar orden y generar inventario'
							: `Marca todas las líneas como revisadas (${reviewedCount}/${items.length})`}
						class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 {actionButtonClasses(
							'success'
						)}"
					>
						<CheckCircle class="h-4 w-4" />
						Confirmar orden
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (showCancelModal = true)}
					disabled={actionLoading}
					class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 {actionButtonClasses(
						'danger'
					)}"
				>
					<XCircle class="h-4 w-4" />
					Cancelar orden
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
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Proveedor</span
			>
			<span class="font-semibold text-brand-navy"
				>{purchaseOrder.supplier?.name ?? 'Sin proveedor'}</span
			>
		</div>
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Documento</span
			>
			<span class="font-semibold text-brand-navy">{documentLabel}</span>
			<span class="font-mono text-sm font-semibold text-brand-navy">
				{documentNumber}
			</span>
		</div>
		<div class="inline-flex items-center rounded-xl bg-surface-container-low px-3 py-2 shadow-sm">
			<PurchaseOrderStatusBadge
				status={purchaseOrder.status}
				isReadyForReview={purchaseOrder.isReadyForReview}
			/>
		</div>
	</div>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1.72fr)_minmax(17rem,0.78fr)]">
		<div class="space-y-6">
			<section class="glass-card overflow-hidden">
				<div
					class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
						>
							<FileText class="h-5 w-5" />
						</div>
						<div>
							<h2 class="text-xl font-semibold text-brand-navy">Detalles de la orden</h2>
							<p class="text-sm text-on-surface-variant">
								Contexto documental y condiciones financieras de la compra.
							</p>
						</div>
					</div>
				</div>

				<div class="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
					<div class="rounded-2xl bg-surface-container-low p-4">
						<div class="flex items-center gap-2 text-sm text-on-surface-variant">
							<Truck class="h-4 w-4" />
							Proveedor
						</div>
						<p class="mt-3 text-base font-semibold text-brand-navy">
							{purchaseOrder.supplier?.name ?? 'Sin proveedor asignado'}
						</p>
					</div>
					<div class="rounded-2xl bg-surface-container-low p-4">
						<div class="flex items-center gap-2 text-sm text-on-surface-variant">
							<Calendar class="h-4 w-4" />
							Fecha de orden
						</div>
						<p class="mt-3 text-base font-semibold text-brand-navy">
							{formatDate(purchaseOrder.orderDate, { dateStyle: 'medium' })}
						</p>
					</div>
					<div class="rounded-2xl bg-surface-container-low p-4">
						<div class="flex items-center gap-2 text-sm text-on-surface-variant">
							<Hash class="h-4 w-4" />
							Documento
						</div>
						<p class="mt-3 text-sm font-semibold text-on-surface-variant">
							{documentLabel}
						</p>
						<p class="mt-1 font-mono text-base font-semibold text-brand-navy">
							{documentNumber}
						</p>
					</div>
					<div class="rounded-2xl bg-surface-container-low p-4">
						<div class="flex items-center gap-2 text-sm text-on-surface-variant">
							<ScrollText class="h-4 w-4" />
							Tasa BCV
						</div>
						<p class="mt-3 font-mono text-base font-semibold text-brand-navy">
							{formatBcvRate(purchaseOrder.bcvRate)}
						</p>
					</div>
				</div>

				{#if supplementalDeliveryNoteNumber || purchaseOrder.notes}
					<div class="grid gap-4 border-t border-outline-variant/15 px-6 py-6 md:grid-cols-2">
						{#if supplementalDeliveryNoteNumber}
							<div class="rounded-2xl bg-surface-container-low p-4">
								<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
									Nota de entrega
								</p>
								<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
									{supplementalDeliveryNoteNumber}
								</p>
							</div>
						{/if}
						{#if purchaseOrder.notes}
							<div class="rounded-2xl bg-surface-container-low p-4">
								<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
									Notas internas
								</p>
								<p class="mt-2 text-sm leading-relaxed text-on-surface">
									{purchaseOrder.notes}
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</section>

			<section class="glass-card overflow-hidden">
				<div
					class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
						>
							<Package class="h-5 w-5" />
						</div>
						<div>
							<h2 class="text-xl font-semibold text-brand-navy">Artículos recibidos</h2>
						</div>
					</div>
					<div class="flex items-center gap-3">
						{#if showReviewColumn}
							<AppBadge variant={allItemsReviewed ? 'success' : 'warning'}>
								{reviewedCount} / {items.length} revisadas
							</AppBadge>
						{/if}
						<AppBadge variant="neutral">{items.length} ítems</AppBadge>
					</div>
				</div>

				{#if items.length > 0}
					<div
						class="flex flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-low/40 px-6 py-3 md:flex-row md:items-center md:justify-between"
					>
						<div class="relative md:max-w-sm md:flex-1">
							<Search class="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-outline" />
							<input
								type="search"
								bind:value={itemSearch}
								placeholder="Buscar por nombre o SKU..."
								class="w-full rounded-lg border-none bg-surface-container-high py-2.5 pr-3 pl-10 text-sm text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
								aria-label="Buscar ítems en la orden"
							/>
						</div>

						{#if showReviewColumn}
							<div
								class="inline-flex rounded-lg bg-surface-container-high p-1 text-xs font-semibold"
							>
								{#each itemReviewFilterOptions as option (option.value)}
									<button
										type="button"
										onclick={() => (itemReviewFilter = option.value)}
										class={[
											'rounded-md px-3 py-1.5 transition-colors',
											itemReviewFilter === option.value
												? 'bg-surface-container-lowest text-brand-navy shadow-sm'
												: 'text-on-surface-variant hover:text-brand-navy'
										]}
										aria-pressed={itemReviewFilter === option.value}
									>
										{option.label}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<div class="overflow-x-auto xl:overflow-visible">
					<table class="min-w-full table-fixed text-left text-sm xl:w-full">
						<colgroup>
							{#if showReviewColumn}
								<col class="w-[5%]" />
							{/if}
							<col class="w-[10%]" />
							<col class="w-[10%]" />
							<col class="w-[19%]" />
							<col class="w-[8%]" />
							<col class="w-[12%]" />
							<col class="w-[13%]" />
							<col class="w-[13%]" />
							{#if isConfirmed}
								<col class="w-[15%]" />
							{/if}
						</colgroup>
						<thead
							class="bg-surface-container-high/70 text-[11px] tracking-[0.18em] text-slate-500 uppercase"
						>
							<tr>
								{#if showReviewColumn}
									<th class="px-2 py-3.5 text-center" aria-label="Revisada"></th>
								{/if}
								<th class="px-4 py-3.5">Tipo</th>
								<th class="px-4 py-3.5">Código</th>
								<th class="px-4 py-3.5">Artículo</th>
								<th class="px-4 py-3.5 text-right">Cantidad</th>
								<th class="px-4 py-3.5 text-right">Costo unitario</th>
								<th class="px-4 py-3.5 text-right">Total compra</th>
								<th class="px-4 py-3.5 text-right">Venta sugerida</th>
								{#if isConfirmed}
									<th class="px-4 py-3.5 text-right">Lote</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-outline-variant/15">
							{#each filteredItems as item (item.id)}
								{@const lot = lotForItem(item)}
								<tr
									class={[
										'align-top transition-colors',
										showReviewColumn && item.isReviewed
											? 'bg-success-container/45 ring-1 ring-success/25 ring-inset hover:bg-success-container/55'
											: 'hover:bg-surface-container-low/60'
									]}
								>
									{#if showReviewColumn}
										<td
											class={[
												'border-l-4 px-2 py-3.5 text-center align-middle',
												item.isReviewed
													? 'border-success bg-success-container/45'
													: 'border-transparent'
											]}
										>
											<button
												type="button"
												onclick={() => handleToggleItemReviewed(item)}
												aria-pressed={item.isReviewed}
												class={[
													'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
													item.isReviewed
														? 'bg-success text-white shadow-sm shadow-success/20 hover:bg-success/85'
														: 'text-outline hover:bg-surface-container-high hover:text-on-surface'
												]}
												aria-label={item.isReviewed
													? 'Marcar como no revisada'
													: 'Marcar como revisada'}
												title={item.isReviewed
													? 'Línea revisada — click para desmarcar'
													: 'Marcar línea como revisada'}
											>
												<CircleCheck class="h-4 w-4" />
											</button>
										</td>
									{/if}
									<td class="px-4 py-3.5">
										<AppBadge variant={itemBadgeVariant(item)}>
											{getPurchaseOrderItemTypeLabel(item.itemType)}
										</AppBadge>
									</td>
									<td class="px-4 py-3.5">
										{#if item.product?.personalCode}
											<span class="font-mono text-sm font-semibold text-brand-navy">
												{item.product.personalCode}
											</span>
										{:else}
											<span class="text-sm text-outline">--</span>
										{/if}
									</td>
									<td class="px-4 py-3.5">
										<p class="max-w-[13rem] text-[15px] leading-5 font-semibold text-brand-navy">
											{itemDisplayName(item)}
										</p>
										<p
											class="mt-1 font-mono text-[11px] leading-4 tracking-[0.12em] break-words text-outline uppercase"
										>
											{itemDisplayMeta(item)}
										</p>
									</td>
									<td class="px-4 py-3.5 text-right font-mono text-brand-navy tabular-nums">
										{item.quantity}
									</td>
									<td class="px-4 py-3.5 text-right font-mono text-brand-navy tabular-nums">
										{formatPrice(item.unitPurchasePrice)}
									</td>
									<td
										class="px-4 py-3.5 text-right font-mono font-semibold text-brand-navy tabular-nums"
									>
										{formatPrice(purchaseLineTotal(item))}
									</td>
									<td class="px-4 py-3.5 text-right">
										<div class="font-mono text-brand-blue tabular-nums">
											{formatPrice(item.unitSalePrice)}
										</div>
										{#if item.appliesIva}
											<p
												class="mt-1 text-[10px] font-semibold tracking-[0.14em] text-success uppercase"
											>
												IVA {item.ivaRate}%
											</p>
										{/if}
									</td>
									{#if isConfirmed}
										<td class="px-4 py-3.5 text-right">
											{#if lot}
												<div class="flex items-start justify-end gap-2">
													<p class="font-mono text-sm font-semibold text-brand-navy">
														{formatLotCode(item.lotId)}
													</p>
													{#if canRevertLot(item)}
														<button
															type="button"
															onclick={() => openRevertModal(item)}
															title="Deshacer recepción completa del lote"
															aria-label="Deshacer recepción completa del lote"
															class="inline-flex h-7 w-7 items-center justify-center rounded-md text-error transition-colors hover:bg-error-container/60 hover:text-on-error-container"
														>
															<RotateCcw class="h-3.5 w-3.5" />
														</button>
													{/if}
												</div>
												<p class="mt-1 text-xs text-on-surface-variant">
													Disponible {lot.quantityAvailable}/{lot.quantityInitial}
												</p>
											{:else}
												<span class="text-sm text-outline">Sin lote</span>
											{/if}
										</td>
									{/if}
								</tr>
							{:else}
								<tr>
									<td
										colspan={(isConfirmed ? 8 : 7) + (showReviewColumn ? 1 : 0)}
										class="px-4 py-12 text-center"
									>
										{#if hasItemFilters}
											<p class="text-sm font-semibold text-on-surface-variant">
												Ningún ítem coincide con el filtro.
											</p>
											<button
												type="button"
												onclick={() => {
													itemSearch = '';
													itemReviewFilter = 'all';
												}}
												class="mt-2 text-sm font-semibold text-brand-blue hover:underline"
											>
												Limpiar filtros
											</button>
										{:else}
											<p class="text-sm font-semibold text-on-surface-variant">
												No hay ítems en esta orden.
											</p>
											<p class="mt-1 text-sm text-outline">
												La cabecera está creada, pero aún no tiene líneas registradas.
											</p>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>

			<section id="purchase-movements" class="glass-card overflow-hidden">
				<div
					class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
						>
							<ArrowRightLeft class="h-5 w-5" />
						</div>
						<h2 class="text-xl font-semibold text-brand-navy">Movimientos generados</h2>
					</div>
					<AppBadge variant="neutral">{movements.length} movimientos</AppBadge>
				</div>

				{#if movements.length > 0}
					<div class="divide-y divide-outline-variant/15">
						{#each movements as movement (movement.id)}
							{@const isInflow = movement.quantityDelta > 0}
							<article class="space-y-3 px-6 py-5">
								<div class="flex flex-wrap items-start justify-between gap-3">
									<div class="space-y-2">
										<AppBadge variant={isInflow ? 'success' : 'error'}>
											{getInventoryMovementTypeLabel(movement.movementType)}
										</AppBadge>
										<p class="text-sm font-semibold text-brand-navy">
											{movementItemName(movement)}
										</p>
									</div>
									<p class="text-xs font-semibold tracking-[0.14em] text-outline uppercase">
										{formatDate(movement.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
									</p>
								</div>

								<p class="text-sm leading-relaxed text-on-surface-variant">
									{movementDescription(movement)}
								</p>

								<div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
									<span class="rounded-full bg-surface-container-low px-3 py-1.5 font-mono">
										{formatLotCode(movement.lotId)}
									</span>
									<span class="font-mono tabular-nums {isInflow ? 'text-success' : 'text-error'}">
										{isInflow ? '+' : ''}{movement.quantityDelta} unidades
									</span>
									<span class="font-mono tabular-nums">
										{movement.quantityBefore} → {movement.quantityAfter}
									</span>
								</div>
							</article>
						{/each}
					</div>
				{:else}
					<div class="px-6 py-10 text-center">
						<p class="text-sm font-semibold text-on-surface-variant">Sin movimientos todavía.</p>
					</div>
				{/if}
			</section>
		</div>

		<aside class="space-y-6">
			<section
				class="rounded-[1.75rem] bg-brand-navy p-6 text-white shadow-[0_28px_60px_-32px_rgba(15,23,42,0.8)]"
			>
				<p class="text-[11px] font-semibold tracking-[0.18em] text-brand-gold uppercase">
					Resumen de valores
				</p>
				<div class="mt-6 space-y-5">
					<div class="rounded-2xl bg-white/8 p-4">
						<p class="text-sm text-white/70">Unidades totales</p>
						<p class="mt-2 font-mono text-3xl font-semibold tabular-nums">{totalUnits}</p>
					</div>
					<div class="rounded-2xl bg-white/8 p-4">
						<p class="text-sm text-white/70">Costo de compra</p>
						<p class="mt-2 font-mono text-2xl font-semibold tabular-nums">
							{formatPrice(totalPurchase)}
						</p>
					</div>
					<div class="rounded-2xl bg-white/8 p-4">
						<p class="text-sm text-white/70">Valor estimado de venta</p>
						<p class="mt-2 font-mono text-2xl font-semibold text-brand-gold tabular-nums">
							{formatPrice(totalSale)}
						</p>
					</div>
					<div class="rounded-2xl bg-white/8 p-4">
						<p class="text-sm text-white/70">Diferencial estimado</p>
						<p
							class="mt-2 font-mono text-2xl font-semibold tabular-nums {totalProfit >= 0
								? 'text-success'
								: 'text-error'}"
						>
							{formatPrice(totalProfit)}
						</p>
					</div>
				</div>
			</section>

			<section class="glass-card overflow-hidden">
				<div
					class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
						>
							<ScrollText class="h-5 w-5" />
						</div>
						<h2 class="text-xl font-semibold text-brand-navy">Registro de auditoría</h2>
					</div>
				</div>

				<div class="space-y-4 px-6 py-6">
					<div class="rounded-2xl bg-surface-container-low p-4">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
							Creado por
						</p>
						<p class="mt-2 font-semibold text-brand-navy">
							{purchaseOrder.createdBy?.fullName ?? 'Usuario no disponible'}
						</p>
						<p class="mt-1 text-sm text-on-surface-variant">
							{formatDate(purchaseOrder.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
						</p>
					</div>

					<div class="rounded-2xl bg-surface-container-low p-4">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
							Confirmado por
						</p>
						{#if purchaseOrder.confirmedAt}
							<p class="mt-2 font-semibold text-brand-navy">
								{purchaseOrder.confirmedBy?.fullName ?? 'Usuario no disponible'}
							</p>
							<p class="mt-1 text-sm text-on-surface-variant">
								{formatDate(purchaseOrder.confirmedAt, {
									dateStyle: 'medium',
									timeStyle: 'short'
								})}
							</p>
						{:else}
							<p class="mt-2 text-sm text-on-surface-variant">Pendiente de confirmación.</p>
						{/if}
					</div>
				</div>
			</section>
		</aside>
	</div>
</div>

<ConfirmModal
	bind:open={showConfirmModal}
	title="Confirmar Orden de Compra"
	message="Al confirmar esta orden se crearán los lotes de inventario y se actualizará el stock de los productos. Esta acción no se puede deshacer."
	confirmLabel="Confirmar Orden"
	confirmColor="green"
	loading={actionLoading}
	onConfirm={handleConfirm}
	onCancel={() => (showConfirmModal = false)}
/>

<ConfirmModal
	bind:open={showMarkReadyModal}
	title="Marcar lista para revisar"
	message={markReadyMessage}
	confirmLabel={markReadyConfirmLabel}
	secondaryLabel={markReadySecondaryLabel}
	confirmColor="yellow"
	secondaryColor="red"
	loading={actionLoading}
	onConfirm={() => handleMarkReady(false)}
	onSecondary={() => handleMarkReady(true)}
	onCancel={() => (showMarkReadyModal = false)}
/>

<ConfirmModal
	bind:open={showUnmarkReadyModal}
	title="Volver a borrador"
	message={unmarkReadyMessage}
	confirmLabel={unmarkReadyConfirmLabel}
	secondaryLabel={unmarkReadySecondaryLabel}
	confirmColor="blue"
	secondaryColor="red"
	loading={actionLoading}
	onConfirm={() => handleUnmarkReady(false)}
	onSecondary={() => handleUnmarkReady(true)}
	onCancel={() => (showUnmarkReadyModal = false)}
/>

<ConfirmModal
	bind:open={showCancelModal}
	title="Cancelar Orden de Compra"
	message="¿Está seguro de cancelar esta orden de compra? Esta acción no se puede deshacer."
	confirmLabel="Cancelar Orden"
	confirmColor="red"
	loading={actionLoading}
	onConfirm={handleCancel}
	onCancel={() => (showCancelModal = false)}
/>

<PriceSuggestionModal
	bind:open={showPriceSuggestionModal}
	suggestions={priceSuggestions}
	loading={priceLoading}
	onApply={handleApplyPrices}
	onSkip={handleSkipPrices}
/>

<ConfirmModal
	bind:open={showRevertModal}
	title="Deshacer recepción del lote"
	message={revertTarget
		? `¿Está seguro de deshacer la recepción del lote de "${revertTarget.productName}" (${revertTarget.quantity} unidades)? Esto vaciará el lote y reducirá el stock disponible del artículo.`
		: ''}
	confirmLabel="Deshacer recepción"
	confirmColor="red"
	loading={revertLoading}
	onConfirm={handleRevertLot}
	onCancel={() => {
		showRevertModal = false;
		revertTarget = null;
	}}
/>
