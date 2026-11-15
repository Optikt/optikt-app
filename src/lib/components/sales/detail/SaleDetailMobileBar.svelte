<script lang="ts">
	import {
		Boxes,
		Calculator,
		CircleX,
		EllipsisVertical,
		FileText,
		History,
		Pen,
		Printer,
		ReceiptText,
		Undo2,
		Wallet,
		X
	} from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import { SaleStatus } from '$lib/shared/enums';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import {
		SALE_STATUS_DESCRIPTIONS,
		SALE_STATUS_FLOW,
		nextStatusTargets,
		saleStatusLabel,
		saleStatusPillClasses
	} from './saleDetail';

	interface Props {
		sale: SaleWithRelations;
		/** Any role except VIEWER (payment CTA). */
		canAct: boolean;
		/** ADMIN/MANAGER always; SELLER only own sales (canManageSaleByOwner). */
		canManageSale: boolean;
		isAdmin: boolean;
		remainingBcvUsd: number;
		printingTickera: boolean;
		onChangeStatus: (target?: SaleStatus) => void;
		onEdit: () => void;
		onPreviewPdf: () => void;
		onOpenPdf: () => void;
		onPrintTickera: () => void;
		onCancel: () => void;
		onPay: () => void;
		/** Wired when the calculator drawer exists; the row hides otherwise. */
		onCalculate?: () => void;
		onOpenHistory: () => void;
		onOpenStock: () => void;
	}

	let {
		sale,
		canAct,
		canManageSale,
		isAdmin,
		remainingBcvUsd,
		printingTickera,
		onChangeStatus,
		onEdit,
		onPreviewPdf,
		onOpenPdf,
		onPrintTickera,
		onCancel,
		onPay,
		onCalculate,
		onOpenHistory,
		onOpenStock
	}: Props = $props();

	// ── Guards (same source as SaleDetailHeroActions — desktop parity) ─────
	const isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	const isPending = $derived(sale.status === SaleStatus.PENDING);
	const isInProgress = $derived(sale.status === SaleStatus.IN_PROGRESS);
	const isReady = $derived(sale.status === SaleStatus.READY);
	const isCompleted = $derived(sale.status === SaleStatus.COMPLETED);

	const statusTargets = $derived.by<SaleStatus[]>(() => {
		if (isCancelled) return [];
		const next = nextStatusTargets(sale.status);
		if (next) return next;
		if (isCompleted && isAdmin) {
			return SALE_STATUS_FLOW.filter((s) => s !== sale.status);
		}
		return [];
	});
	const isActiveEditable = $derived(isPending || isInProgress || isReady);
	const showStatusMenu = $derived(canManageSale && statusTargets.length > 0);
	const showEdit = $derived(canManageSale && isActiveEditable);
	const showCancel = $derived(canManageSale && isActiveEditable);
	const canPrintReceipt = $derived(
		!isCancelled && (isPending || isInProgress || isReady || isCompleted)
	);
	const showPaymentForm = $derived(canAct && !isCancelled && remainingBcvUsd > 0.01);
	const showRevertOption = $derived(isAdmin && !isCancelled && !isPending);

	/** The bar only exists when there is a primary action (spec: no hero actions otherwise). */
	const showBar = $derived(showPaymentForm || canPrintReceipt);

	let sheetOpen = $state(false);

	function run(action: () => void) {
		sheetOpen = false;
		action();
	}
</script>

{#if showBar}
	<div
		class="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/60 bg-surface-container-lowest/95 backdrop-blur print:hidden"
	>
		<div
			class="mx-auto flex w-full max-w-[1760px] items-center gap-2 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
		>
			{#if showPaymentForm}
				<button
					type="button"
					onclick={onPay}
					class="h-11 flex-1 rounded-lg bg-brand-gold text-[15px] font-bold text-brand-navy transition-transform duration-150 active:scale-[.98]"
				>
					Cobrar
				</button>
			{:else if canPrintReceipt}
				<button
					type="button"
					onclick={onPreviewPdf}
					class="h-11 flex-1 rounded-lg bg-brand-gold text-[15px] font-bold text-brand-navy transition-transform duration-150 active:scale-[.98]"
				>
					Imprimir
				</button>
			{/if}
			<button
				type="button"
				onclick={() => (sheetOpen = true)}
				aria-haspopup="dialog"
				class="inline-flex h-11 items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-4 text-[15px] font-semibold text-on-surface"
			>
				<EllipsisVertical class="h-4 w-4" />
				Más
			</button>
		</div>
	</div>
{/if}

<SlideOver bind:open={sheetOpen} direction="bottom">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between px-5 pt-3 pb-2">
			<h2 class="font-heading text-base font-bold text-brand-navy">Acciones de la venta</h2>
			<button
				type="button"
				onclick={onclose}
				aria-label="Cerrar acciones"
				class="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
		{#if showStatusMenu}
			{#each statusTargets as target (target)}
				<button
					type="button"
					onclick={() => run(() => onChangeStatus(target))}
					class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
				>
					<span
						class="rounded px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] whitespace-nowrap uppercase {saleStatusPillClasses(
							target
						)}"
					>
						{saleStatusLabel(target)}
					</span>
					<span class="min-w-0 flex-1 text-[13px] text-on-surface-variant">
						{SALE_STATUS_DESCRIPTIONS[target] ?? ''}
					</span>
				</button>
			{/each}
		{/if}
		{#if showRevertOption}
			<button
				type="button"
				onclick={() => run(() => onChangeStatus())}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Undo2 class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Volver a estado…</span>
			</button>
		{/if}
		{#if showEdit}
			<button
				type="button"
				onclick={() => run(onEdit)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Pen class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Editar</span>
			</button>
		{/if}
		{#if canPrintReceipt}
			<button
				type="button"
				onclick={() => run(onPreviewPdf)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<FileText class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Ver recibo</span>
			</button>
			<button
				type="button"
				onclick={() => run(onOpenPdf)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Printer class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Imprimir PDF</span>
			</button>
			<button
				type="button"
				disabled={printingTickera}
				onclick={() => run(onPrintTickera)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high disabled:opacity-50"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<ReceiptText class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">
					{printingTickera ? 'Imprimiendo…' : 'Imprimir tickera'}
				</span>
			</button>
		{/if}
		{#if onCalculate}
			<button
				type="button"
				onclick={() => run(onCalculate)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Calculator class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Calcular factura</span>
			</button>
		{/if}
		{#if showPaymentForm}
			<button
				type="button"
				onclick={() => run(onPay)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Wallet class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Registrar pago</span>
			</button>
		{/if}
		<button
			type="button"
			onclick={() => run(onOpenHistory)}
			class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
		>
			<span
				class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
			>
				<History class="h-4 w-4" />
			</span>
			<span class="text-sm font-semibold text-on-surface">Historial</span>
		</button>
		<button
			type="button"
			onclick={() => run(onOpenStock)}
			class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
		>
			<span
				class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
			>
				<Boxes class="h-4 w-4" />
			</span>
			<span class="text-sm font-semibold text-on-surface">Movimientos de stock</span>
		</button>
		{#if showCancel}
			<div class="mx-3 my-1.5 h-px bg-outline-variant/40"></div>
			<button
				type="button"
				onclick={() => run(onCancel)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-error-container"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-error-container text-on-error-container"
				>
					<CircleX class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-error">Cancelar venta</span>
			</button>
		{/if}
	</div>
</SlideOver>
