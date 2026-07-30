<script lang="ts">
	import {
		ChevronDown,
		ClipboardCheck,
		MoreVertical,
		Pencil,
		RotateCcw,
		CircleCheck,
		CircleX,
		ArrowLeft
	} from '@lucide/svelte';
	import { AppBadge, PurchaseOrderStatusBadge } from '$lib/components/ui';
	import { PurchaseOrderStatus, PurchasePaymentTerms } from '$lib/shared/enums';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import { resolve } from '$app/paths';

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
	let showOverflowMenu = $state(false);

	function handleOverflowOutsideClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-overflow-menu]')) {
			showOverflowMenu = false;
		}
	}

	function overflowEdit() {
		showOverflowMenu = false;
		onEdit();
	}

	function overflowUnmark() {
		showOverflowMenu = false;
		onUnmarkReady();
	}

	function overflowConfirmAndPay() {
		showOverflowMenu = false;
		onConfirmAndPay();
	}

	function overflowCancel() {
		showOverflowMenu = false;
		onCancel();
	}
</script>

<svelte:document onclick={handleOverflowOutsideClick} />

<div class="px-2 pt-2 flex flex-wrap items-center gap-2">
	<a
		title="Volver a la lista de compras"
		href={resolve('/purchases')}
		class="text-on-surface-variant transition-colors hover:text-brand-blue"
	>
		<ArrowLeft size={24} />
	</a>
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
			<AppBadge variant="neutral">
				{purchaseOrder.paymentTerms === 'CONTADO' ? 'Contado' : 'Crédito'}
			</AppBadge>
			{#if !allItemsReviewed}
				<AppBadge variant="info">
					{reviewedCount}/{totalItems} revisadas
				</AppBadge>
			{/if}
		</div>
	</div>

	<!-- ─── DESKTOP (sm+) ──────────────────────────────────────────────── -->
	<div class="hidden sm:flex flex-wrap gap-2 items-center shrink-0">
		{#if isDraft && !isReadyForReview}
			<button
				type="button"
				onclick={onEdit}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl border border-brand-blue/30 px-4 py-2 text-xs font-semibold text-brand-blue transition-colors hover:bg-info-container/40"
			>
				<Pencil class="h-4 w-4" />
				Editar
			</button>
			<button
				type="button"
				onclick={onMarkReady}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-xs font-semibold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark"
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
				class="inline-flex items-center gap-2 rounded-xl border border-brand-blue/30 px-4 py-2 text-xs font-semibold text-brand-blue transition-colors hover:bg-info-container/40"
			>
				<RotateCcw class="h-4 w-4" />
				Editar
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
					<CircleCheck class="h-4 w-4" />
					Confirmar
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
							<CircleCheck class="h-4 w-4 text-success" />
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
				<CircleX class="h-4 w-4" />
				Cancelar
			</button>
		{/if}
	</div>

	<!-- ─── MOBILE (< sm) ──────────────────────────────────────────────── -->
	<div class="flex sm:hidden items-center gap-2 shrink-0">
		{#if isDraft && !isReadyForReview}
			<button
				type="button"
				onclick={onMarkReady}
				disabled={actionLoading}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-xs font-semibold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark"
			>
				<ClipboardCheck class="h-4 w-4" />
				Marcar listo
			</button>
		{/if}
		{#if isDraft && isReadyForReview}
			<button
				type="button"
				onclick={onConfirm}
				disabled={actionLoading || !allItemsReviewed}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2 text-xs font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
			>
				<CircleCheck class="h-4 w-4" />
				Confirmar
			</button>
		{/if}
		{#if isDraft}
			<div class="relative" data-overflow-menu>
				<button
					type="button"
					onclick={() => (showOverflowMenu = !showOverflowMenu)}
					disabled={actionLoading}
					class="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high"
					aria-label="Más opciones"
				>
					<MoreVertical class="h-5 w-5" />
				</button>
				{#if showOverflowMenu}
					<div
						class="absolute top-full right-0 z-50 mt-1 min-w-44 rounded-xl bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant/20 overflow-hidden"
					>
						{#if isDraft && !isReadyForReview}
							<button
								type="button"
								onclick={overflowEdit}
								class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
							>
								<Pencil class="h-4 w-4" />
								Editar
							</button>
						{/if}
						{#if isDraft && isReadyForReview}
							<button
								type="button"
								onclick={overflowUnmark}
								class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
							>
								<RotateCcw class="h-4 w-4" />
								Editar
							</button>
							{#if isCashPurchase}
								<button
									type="button"
									onclick={overflowConfirmAndPay}
									class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
								>
									<CircleCheck class="h-4 w-4 text-success" />
									Confirmar y pagar
								</button>
							{/if}
						{/if}
						<button
							type="button"
							onclick={overflowCancel}
							class="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-error transition-colors hover:bg-error-container/30"
						>
							<CircleX class="h-4 w-4" />
							Cancelar
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
