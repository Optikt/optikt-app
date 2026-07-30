<script lang="ts">
	import {
		CheckCircle,
		ChevronDown,
		ClipboardCheck,
		Pencil,
		RotateCcw,
		XCircle
	} from '@lucide/svelte';
	import { AppBadge, PurchaseOrderStatusBadge } from '$lib/components/ui';
	import { PurchaseOrderStatus, PurchasePaymentTerms } from '$lib/shared/enums';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import { formatDateOnly } from '$lib/utils';

	interface Props {
		purchaseOrder: PurchaseOrderWithRelations;
		formattedOrderNumber: string;
		reviewedCount: number;
		totalItems: number;
		allItemsReviewed: boolean;
		actionLoading: boolean;
		onEdit: () => void;
		onMarkReady: () => void;
		onUnmarkReady: () => void;
		onConfirm: () => void;
		onConfirmAndPay: () => void;
		onCancel: () => void;
	}

	let {
		purchaseOrder,
		formattedOrderNumber,
		reviewedCount,
		totalItems,
		allItemsReviewed,
		actionLoading,
		onEdit,
		onMarkReady,
		onUnmarkReady,
		onConfirm,
		onConfirmAndPay,
		onCancel
	}: Props = $props();

	const isDraft = $derived(purchaseOrder.status === PurchaseOrderStatus.DRAFT);
	const isReadyForReview = $derived(Boolean(purchaseOrder.isReadyForReview));
	const isCashPurchase = $derived(
		(purchaseOrder.paymentTerms as PurchasePaymentTerms) === PurchasePaymentTerms.CONTADO
	);

	let showConfirmDropdown = $state(false);
</script>

<!-- class="rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20 p-4 animate-slide-up d1" -->
<div class="px-2 pt-2 flex flex-wrap items-center justify-between gap-4">
	<div class="flex flex-wrap gap-2 items-center">
		<h1
			class="font-heading text-[30px] font-bold text-brand-navy tracking-tight leading-none whitespace-nowrap"
		>
			{formattedOrderNumber}
		</h1>
		<div class="flex items-center gap-2 flex-wrap shrink-0">
			<PurchaseOrderStatusBadge
				status={purchaseOrder.status}
				isReadyForReview={purchaseOrder.isReadyForReview}
			/>
			{#if !allItemsReviewed}
				<AppBadge variant="info">
					{reviewedCount}/{totalItems} revisadas
				</AppBadge>
			{/if}
			<AppBadge variant="neutral">
				{purchaseOrder.paymentTerms === 'CONTADO' ? 'Contado' : 'Crédito'}
			</AppBadge>
		</div>

		<!-- <p class="mt-2 text-[13px] text-on-surface-variant">
					Orden de compra creada el {formatDateOnly(purchaseOrder.orderDate, {
						dateStyle: 'long'
					})} · Tasa BCV {Number(purchaseOrder.bcvRate || 0).toFixed(2)}
				</p> -->
	</div>
	<div class="flex flex-wrap gap-2 items-center shrink-0">
		{#if isDraft && !isReadyForReview}
			<button
				type="button"
				onclick={onEdit}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				<Pencil class="h-4 w-4" />
				Editar
			</button>
			<button
				type="button"
				onclick={onMarkReady}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-navy/90"
			>
				<ClipboardCheck class="h-4 w-4" />
				Marcar listo
			</button>
		{/if}
		{#if isDraft && isReadyForReview}
			<button
				type="button"
				onclick={onUnmarkReady}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				<RotateCcw class="h-4 w-4" />
				Volver a edición
			</button>
			<div class="relative flex items-center gap-0">
				<button
					type="button"
					onclick={onConfirm}
					disabled={actionLoading || !allItemsReviewed}
					title={allItemsReviewed
						? 'Confirmar orden y generar inventario'
						: `Marca todas las líneas como revisadas (${reviewedCount}/${totalItems})`}
					class="inline-flex items-center gap-2 rounded-l-xl bg-brand-gold px-5 py-2 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
				>
					<CheckCircle class="h-4 w-4" />
					Confirmar orden
				</button>
				{#if isCashPurchase}
					<button
						type="button"
						onclick={() => (showConfirmDropdown = !showConfirmDropdown)}
						disabled={actionLoading || !allItemsReviewed}
						class="inline-flex items-center justify-center rounded-r-xl bg-brand-gold px-2 py-2 text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark border-l border-brand-gold-dark/30 disabled:cursor-not-allowed disabled:opacity-60"
						aria-label="Más opciones"
					>
						<ChevronDown class="h-4 w-4" />
					</button>
				{/if}
				{#if showConfirmDropdown}
					<div
						class="absolute top-full right-0 z-50 mt-1 min-w-[200px] rounded-lg bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant/20 overflow-hidden"
						onblur={() => (showConfirmDropdown = false)}
						tabindex="-1"
					>
						<button
							type="button"
							onclick={() => {
								showConfirmDropdown = false;
								onConfirmAndPay();
							}}
							class="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
						>
							<CheckCircle class="h-4 w-4 text-success" />
							Confirmar y registrar pago
						</button>
					</div>
				{/if}
			</div>
		{/if}
		{#if isDraft}
			<button
				type="button"
				onclick={onCancel}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl border border-error/30 px-4 py-2 text-xs font-semibold text-error transition-colors hover:bg-error-container/20"
			>
				<XCircle class="h-4 w-4" />
				Cancelar
			</button>
		{/if}
	</div>
</div>
