<script lang="ts">
	import {
		CircleX,
		ChevronDown,
		ChevronUp,
		Eye,
		FileText,
		FlaskConical,
		History,
		Package,
		ShoppingCart,
		Wallet
	} from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { CancelSaleModal, PaymentForm, PaymentsTable } from '$lib/components/sales';
	import { PageHeader, SaleStatusBadge } from '$lib/components/ui';
	import { computeSnapshotTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
	import { formatDate, formatPrice } from '$lib/utils';
	import {
		DiscountType,
		getInventoryMovementTypeLabel,
		getTreatmentCategoryLabel,
		InventoryMovementType,
		RefundStatus,
		SaleStatus
	} from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { untrack } from 'svelte';

	interface DisplayGroup {
		key: string;
		item: SaleItemWithDetails;
		quantity: number;
		discountAmount: number;
		lineTotal: number;
		treatments: SaleItemWithDetails[];
	}

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
	let isPending = $derived(sale.status === SaleStatus.PENDING);
	let isCompleted = $derived(sale.status === SaleStatus.COMPLETED);
	let isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	let showPaymentForm = $derived(isPending && remainingBcvUsd > 0.01);
	let saleDiscountAmount = $derived.by(() => {
		if (sale.discountType === DiscountType.PERCENTAGE) {
			return (sale.discount / 100) * sale.subtotal;
		}

		return sale.discount;
	});
	let taxBreakdown = $derived(computeSnapshotTaxBreakdown(items));
	let mainItems = $derived(items.filter((item) => item.itemType !== SaleItemType.TREATMENT));
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

	function getTreatments(parentId: string): SaleItemWithDetails[] {
		return items.filter(
			(item) => item.itemType === SaleItemType.TREATMENT && item.parentSaleItemId === parentId
		);
	}

	function itemDiscountAmount(item: SaleItemWithDetails): number {
		if (item.discountType === DiscountType.PERCENTAGE) {
			return (item.discount / 100) * item.unitPrice * item.quantity;
		}

		return item.discount;
	}

	let displayGroups: DisplayGroup[] = $derived.by(() => {
		const groups: DisplayGroup[] = [];
		const lensGroupMap = new SvelteMap<string, DisplayGroup>();

		for (const item of mainItems) {
			if (item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItemId) {
				const existing = lensGroupMap.get(item.lensCatalogItemId);
				if (existing) {
					existing.quantity += item.quantity;
					existing.discountAmount += itemDiscountAmount(item);
					existing.lineTotal += item.unitPrice * item.quantity - itemDiscountAmount(item);
					existing.treatments.push(...getTreatments(item.id));
				} else {
					const discountAmount = itemDiscountAmount(item);
					const group: DisplayGroup = {
						key: `lens-${item.lensCatalogItemId}`,
						item,
						quantity: item.quantity,
						discountAmount,
						lineTotal: item.unitPrice * item.quantity - discountAmount,
						treatments: [...getTreatments(item.id)]
					};

					lensGroupMap.set(item.lensCatalogItemId, group);
					groups.push(group);
				}
			} else {
				const discountAmount = itemDiscountAmount(item);
				groups.push({
					key: item.id,
					item,
					quantity: item.quantity,
					discountAmount,
					lineTotal: item.unitPrice * item.quantity - discountAmount,
					treatments: getTreatments(item.id)
				});
			}
		}

		return groups;
	});

	function actionButtonClasses(variant: 'neutral' | 'danger'): string {
		if (variant === 'danger') {
			return 'bg-error-container text-on-error-container hover:bg-error-container/80';
		}

		return 'bg-surface-container-low text-brand-navy hover:bg-surface-container-high';
	}

	function itemLabel(group: DisplayGroup): string {
		return group.item.product?.name ?? group.item.lensCatalogItem?.name ?? 'Item sin nombre';
	}

	function itemTypeLabel(item: SaleItemWithDetails): string {
		if (item.itemType === SaleItemType.LENS_PAIR || item.lensCatalogItem) return 'Cristal';
		return 'Producto';
	}

	function itemTypeClasses(item: SaleItemWithDetails): string {
		if (item.itemType === SaleItemType.LENS_PAIR || item.lensCatalogItem) {
			return 'bg-info-container text-on-info-container';
		}

		return 'bg-surface-container-high text-on-surface-variant';
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

	function movementCardClasses(movementType: string): string {
		switch (movementType) {
			case InventoryMovementType.CANCEL_REVERT:
			case InventoryMovementType.RETURN_IN:
			case InventoryMovementType.PURCHASE_IN:
			case InventoryMovementType.ADJUSTMENT_IN:
				return 'bg-success-container/55 text-on-success-container';
			case InventoryMovementType.SALE_OUT:
			case InventoryMovementType.ADJUSTMENT_OUT:
			default:
				return 'bg-error-container/55 text-on-error-container';
		}
	}

	function movementQuantityClasses(quantityDelta: number): string {
		return quantityDelta > 0 ? 'text-success' : 'text-error';
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

	function scrollToHistory() {
		document.getElementById('sale-history')?.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
	}

	function togglePaymentComposer(forceOpen?: boolean) {
		showPaymentComposer = forceOpen ?? !showPaymentComposer;

		if (showPaymentComposer) {
			requestAnimationFrame(() => {
				document.getElementById('payment-composer')?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
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
				onclick={scrollToHistory}
				class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors {actionButtonClasses(
					'neutral'
				)}"
			>
				<History class="h-4 w-4" />
				Ver historial
			</button>

			{#if isPending}
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

	<section class="glass-card overflow-hidden">
		<div
			class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<ShoppingCart class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-xl font-semibold text-brand-navy">Artículos y servicios</h2>
					<p class="text-sm text-on-surface-variant">
						{displayGroups.length} línea{displayGroups.length !== 1 ? 's' : ''} principal{displayGroups.length !==
						1
							? 'es'
							: ''}
					</p>
				</div>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full min-w-[880px] text-sm">
				<thead class="bg-surface-container-low text-left">
					<tr>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Artículo</th
						>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Tipo</th
						>
						<th
							class="px-6 py-4 text-center text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Cant.</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Precio unit.</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Desc.</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Subtotal</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-low">
					{#each displayGroups as group (group.key)}
						<tr
							class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/35"
						>
							<td class="px-6 py-5 align-top">
								<div class="flex items-start gap-4">
									<div
										class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {group
											.item.lensCatalogItem
											? 'bg-info-container text-on-info-container'
											: 'bg-surface-container-low text-on-surface-variant'}"
									>
										{#if group.item.lensCatalogItem}
											<Eye class="h-5 w-5" />
										{:else}
											<Package class="h-5 w-5" />
										{/if}
									</div>
									<div>
										<p class="text-lg leading-tight font-semibold text-brand-navy">
											{itemLabel(group)}
										</p>
										<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
											{#if group.item.product?.sku}
												<span class="font-mono">{group.item.product.sku}</span>
											{/if}
											{#if group.item.snapshotCostUnit != null}
												<span class="font-mono">
													Costo {formatPrice(group.item.snapshotCostUnit)}
													{#if group.item.snapshotLotsCount != null && group.item.snapshotLotsCount > 1}
														· {group.item.snapshotLotsCount} lotes
													{/if}
												</span>
											{/if}
										</div>
									</div>
								</div>
							</td>
							<td class="px-6 py-5 align-top">
								<span
									class="inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase {itemTypeClasses(
										group.item
									)}"
								>
									{itemTypeLabel(group.item)}
								</span>
							</td>
							<td
								class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
								>{group.quantity}</td
							>
							<td
								class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant"
							>
								{formatPrice(group.item.unitPrice)}
							</td>
							<td
								class="px-6 py-5 text-right align-top font-mono text-base {group.discountAmount > 0
									? 'text-error'
									: 'text-outline'}"
							>
								{#if group.discountAmount > 0}
									-{formatPrice(group.discountAmount)}
									{#if group.item.discountType === DiscountType.PERCENTAGE}
										<span class="text-xs text-outline">({group.item.discount}%)</span>
									{/if}
								{:else}
									$0.00
								{/if}
							</td>
							<td
								class="px-6 py-5 text-right align-top font-mono text-lg font-bold text-brand-navy"
							>
								{formatPrice(group.lineTotal)}
							</td>
						</tr>

						{#each group.treatments as treatment (treatment.id)}
							<tr
								class="bg-surface-container-lowest/80 transition-colors hover:bg-surface-container-low/35"
							>
								<td class="px-6 py-5 align-top">
									<div class="flex items-start gap-4">
										<div
											class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-container text-on-purple-container"
										>
											<FlaskConical class="h-5 w-5" />
										</div>
										<div>
											<p class="text-lg leading-tight font-semibold text-brand-navy">
												{treatment.supplierTreatment?.name ?? 'Tratamiento'}
											</p>
											{#if treatment.supplierTreatment?.category}
												<p class="mt-1 text-xs text-outline">
													{getTreatmentCategoryLabel(treatment.supplierTreatment.category)}
												</p>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-6 py-5 align-top">
									<span
										class="inline-flex rounded-full bg-purple-container px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-on-purple-container uppercase"
									>
										Tratamiento
									</span>
								</td>
								<td
									class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
									>{treatment.quantity}</td
								>
								<td
									class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant"
								>
									{formatPrice(treatment.unitPrice)}
								</td>
								<td class="px-6 py-5 text-right align-top font-mono text-base text-outline"
									>$0.00</td
								>
								<td
									class="px-6 py-5 text-right align-top font-mono text-lg font-bold text-brand-navy"
								>
									{formatPrice(treatment.unitPrice * treatment.quantity)}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
				<tfoot class="bg-surface-container-low/60">
					<tr>
						<td
							colspan="5"
							class="px-6 py-5 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>
							Subtotal general
						</td>
						<td class="px-6 py-5 text-right font-mono text-2xl font-bold text-brand-navy">
							{formatPrice(sale.subtotal)}
						</td>
					</tr>
				</tfoot>
			</table>
		</div>
	</section>

	<section class="grid gap-4 xl:grid-cols-4">
		<div class="rounded-[1.5rem] bg-surface-container-low px-6 py-6 shadow-sm">
			<div class="space-y-4 text-sm text-on-surface-variant">
				<div class="flex items-center justify-between gap-4">
					<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
						>Subtotal</span
					>
					<span class="font-mono text-base font-semibold text-brand-navy"
						>{formatPrice(sale.subtotal)}</span
					>
				</div>

				{#if saleDiscountAmount > 0}
					<div class="flex items-center justify-between gap-4">
						<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
							Descuento global
							{#if sale.discountType === DiscountType.PERCENTAGE}
								({sale.discount}%)
							{/if}
						</span>
						<span class="font-mono text-base font-semibold text-error"
							>-{formatPrice(saleDiscountAmount)}</span
						>
					</div>
				{/if}

				<div class="h-px bg-surface-container-high"></div>

				<div class="flex items-center justify-between gap-4">
					<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
						>Subtotal neto</span
					>
					<span class="font-mono text-base font-semibold text-brand-navy"
						>{formatPrice(sale.subtotal - saleDiscountAmount)}</span
					>
				</div>

				{#if taxBreakdown.taxableBase > 0}
					<div class="flex items-center justify-between gap-4">
						<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
							>Base imponible</span
						>
						<span class="font-mono text-base font-semibold text-brand-navy"
							>{formatPrice(taxBreakdown.taxableBase)}</span
						>
					</div>
				{/if}

				{#if taxBreakdown.exemptTotal > 0}
					<div class="flex items-center justify-between gap-4">
						<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
							>Exento</span
						>
						<span class="font-mono text-base font-semibold text-brand-navy"
							>{formatPrice(taxBreakdown.exemptTotal)}</span
						>
					</div>
				{/if}

				{#if taxBreakdown.taxAmount > 0}
					<div class="flex items-center justify-between gap-4">
						<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
							>IVA (16%)</span
						>
						<span class="font-mono text-base font-semibold text-brand-navy"
							>{formatPrice(taxBreakdown.taxAmount)}</span
						>
					</div>
				{/if}
			</div>

			<div class="mt-8 border-t border-surface-container-high pt-6">
				<p class="text-sm font-bold tracking-[0.14em] text-brand-navy uppercase">Total a pagar</p>
				<p
					class="mt-3 font-mono text-4xl font-bold tracking-tight text-brand-navy md:text-[2.85rem]"
				>
					{formatPrice(sale.total)}
				</p>
			</div>
		</div>

		<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Total deuda</p>
			<p class="mt-4 font-mono text-3xl font-bold tracking-tight text-brand-navy md:text-4xl">
				{formatPrice(sale.total)}
			</p>
			<p class="mt-3 text-base text-on-surface-variant">Monto total comprometido en esta venta.</p>
		</div>

		<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
			<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Total pagado</p>
			<p class="mt-4 font-mono text-3xl font-bold tracking-tight text-success md:text-4xl">
				{formatPrice(sale.paidAmountBcvUsd)}
			</p>
			{#if payments.length > 0}
				<p class="mt-3 text-base text-on-surface-variant">
					{payments.length} pago{payments.length !== 1 ? 's' : ''} registrado{payments.length !== 1
						? 's'
						: ''}
				</p>
			{:else}
				<p class="mt-3 text-base text-on-surface-variant">Aún no se han registrado abonos.</p>
			{/if}
		</div>

		<div
			class="rounded-[1.5rem] px-6 py-6 shadow-[0_10px_30px_rgba(21,35,70,0.14)] {remainingBcvUsd >
			0.01
				? 'bg-brand-navy text-white'
				: 'bg-success-container text-on-success-container'}"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<p
						class="text-xs font-semibold tracking-[0.14em] uppercase {remainingBcvUsd > 0.01
							? 'text-white/68'
							: 'text-on-success-container/70'}"
					>
						Saldo pendiente
					</p>
					<p
						class="mt-4 font-mono text-3xl font-bold tracking-tight md:text-4xl {remainingBcvUsd >
						0.01
							? 'text-white'
							: 'text-on-success-container'}"
					>
						{formatPrice(remainingBcvUsd)}
					</p>
				</div>

				<span
					class="rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.16em] uppercase {remainingBcvUsd >
					0.01
						? 'bg-brand-gold/15 text-brand-gold'
						: 'bg-white/30 text-on-success-container'}"
				>
					{remainingBcvUsd > 0.01 ? 'Prioridad' : 'Cubierto'}
				</span>
			</div>

			<div class="mt-6 h-2 rounded-full {remainingBcvUsd > 0.01 ? 'bg-white/10' : 'bg-white/35'}">
				<div
					class="h-full rounded-full {remainingBcvUsd > 0.01 ? 'bg-brand-gold' : 'bg-white'}"
					style={`width: ${paymentProgressPercent}%`}
				></div>
			</div>

			<div
				class="mt-3 flex items-center justify-between text-sm {remainingBcvUsd > 0.01
					? 'text-white/75'
					: 'text-on-success-container/80'}"
			>
				<span>Cubierto</span>
				<span class="font-mono font-semibold">{formatPrice(sale.paidAmountBcvUsd)}</span>
			</div>

			<div class="mt-4 space-y-3">
				{#if isCancelled && sale.refundStatus && sale.refundStatus !== RefundStatus.NO_PAYMENT}
					<p
						class="text-base {remainingBcvUsd > 0.01
							? 'text-white/80'
							: 'text-on-success-container/80'}"
					>
						{refundDecisionTitle()} por
						<span class="font-mono font-semibold">{formatPrice(sale.refundAmount ?? 0)}</span>
					</p>
				{:else if remainingBcvUsd > 0.01}
					<p class="text-base text-white/80">Este es el monto que falta para cerrar la venta.</p>
				{:else if isCompleted}
					<p class="text-base text-on-success-container/80">
						La venta ya quedó completamente cubierta.
					</p>
				{/if}
			</div>
		</div>
	</section>

	<section id="sale-history" class="space-y-4">
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

				<div class="text-right text-sm text-on-surface-variant">
					<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Tasa BCV</p>
					<p class="mt-1 font-mono text-base font-semibold text-brand-blue">
						{bcvRate.toFixed(2)} Bs/$
					</p>
				</div>
			</div>

			<div class="px-6 pb-6">
				<PaymentsTable
					{payments}
					saleId={sale.id}
					allowVoid={isPending}
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

	{#if movements.length > 0}
		<section class="glass-card overflow-hidden">
			<div class="flex items-center gap-3 bg-surface-container-lowest px-6 py-5">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<Package class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-xl font-semibold text-brand-navy">Movimientos de Stock</h2>
					<p class="text-sm text-on-surface-variant">
						Impacto de la venta sobre inventario y reversiones asociadas.
					</p>
				</div>
			</div>

			<div class="grid gap-4 px-6 py-6 lg:grid-cols-2">
				{#each movements as movement (movement.id)}
					<div class="rounded-[1.5rem] bg-surface-container-low p-5">
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-start gap-4">
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {movementCardClasses(
										movement.movementType
									)}"
								>
									<Package class="h-5 w-5" />
								</div>
								<div>
									<p class="text-sm font-black tracking-[0.14em] text-brand-navy uppercase">
										{movement.productName ?? 'Movimiento inventario'}
									</p>
									<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
										{#if movement.productSku}
											<span class="font-mono">ID: {movement.productSku}</span>
										{/if}
										{#if movement.lotNumber != null}
											<span class="font-mono"
												>Lote L-{String(movement.lotNumber).padStart(4, '0')}</span
											>
										{/if}
										<span
											>{formatDate(movement.createdAt, {
												dateStyle: 'medium',
												timeStyle: 'short'
											})}</span
										>
									</div>
									{#if movement.createdByName}
										<p class="mt-2 text-sm text-on-surface-variant">
											Realizado por {movement.createdByName}
										</p>
									{/if}
								</div>
							</div>

							<div class="text-right">
								<p
									class="font-mono text-xl font-bold {movementQuantityClasses(
										movement.quantityDelta
									)}"
								>
									{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}
								</p>
								<p
									class="mt-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
								>
									{getInventoryMovementTypeLabel(movement.movementType)}
								</p>
								{#if movement.totalCostAtAdjustment != null}
									<p class="mt-2 font-mono text-xs text-outline">
										{formatPrice(movement.totalCostAtAdjustment)}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

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
