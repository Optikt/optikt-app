<script lang="ts">
	import {
		ChevronDown,
		CircleX,
		EllipsisVertical,
		FileText,
		Pen,
		Play,
		Printer,
		ReceiptText,
		Undo2
	} from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { SaleStatus } from '$lib/shared/enums';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import {
		SALE_STATUS_FLOW,
		SALE_STATUS_DESCRIPTIONS,
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
		onPay
	}: Props = $props();

	// ── Status gating (was in SaleDetailHero) ─────────────────────────────
	const isCancelled = $derived(sale.status === SaleStatus.CANCELLED);
	const isPending = $derived(sale.status === SaleStatus.PENDING);
	const isInProgress = $derived(sale.status === SaleStatus.IN_PROGRESS);
	const isReady = $derived(sale.status === SaleStatus.READY);
	const isCompleted = $derived(sale.status === SaleStatus.COMPLETED);

	/** Forward moves (+ all non-current states for admins on COMPLETED). */
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
	const hasActionsRow = $derived(showStatusMenu || showEdit || canPrintReceipt || showCancel);
	/**
	 * "Volver a estado…" lives in the ⋯ menu, above "Cancelar venta": backward
	 * transitions are admin-only and need a reason, which SaleStatusModal
	 * already enforces when it opens without a preset (full target list).
	 */
	const showRevertOption = $derived(isAdmin && !isCancelled && !isPending);

	// ── Menu state ────────────────────────────────────────────────────────
	let statusOpen = $state(false);
	let printOpen = $state(false);
	let moreOpen = $state(false);

	function selectStatus(target: SaleStatus) {
		statusOpen = false;
		onChangeStatus(target);
	}

	/**
	 * Menu-option tooltips must open on HOVER only: the popover focuses the
	 * first option on open, and a focus-triggered tooltip would pop up by
	 * itself the moment the dropdown opens (design review).
	 */
	function hoverOnly(props: Record<string, unknown>): Record<string, unknown> {
		const rest = { ...props };
		delete rest.onfocus;
		delete rest.onFocus;
		delete rest.onfocusin;
		delete rest.onFocusIn;
		return rest;
	}
</script>

{#snippet statusMenu()}
	{#if showStatusMenu}
		<Popover.Root bind:open={statusOpen}>
			<Popover.Trigger class="hero-btn hero-btn-primary max-w-[260px] flex-[1.4_1_0]">
				<Play class="h-3.5 w-3.5" />
				Cambiar estado
				<ChevronDown class="h-3.5 w-3.5" />
			</Popover.Trigger>
			<Popover.Content
				align="start"
				class="anim-pop z-[80] w-[230px] rounded-xl bg-white p-1.5 text-on-surface shadow-xl"
			>
				{#each statusTargets as target (target)}
					{#snippet targetOption({ props }: { props: Record<string, unknown> })}
						<button
							{...hoverOnly(props)}
							type="button"
							onclick={() => selectStatus(target)}
							class="flex w-full items-center rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-info-container focus-visible:outline-2 focus-visible:outline-brand-blue"
						>
							<span
								class="rounded px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] whitespace-nowrap uppercase {saleStatusPillClasses(
									target
								)}"
							>
								{saleStatusLabel(target)}
							</span>
						</button>
					{/snippet}
					{#if SALE_STATUS_DESCRIPTIONS[target]}
						<TriggerTooltip
							trigger={targetOption}
							text={SALE_STATUS_DESCRIPTIONS[target]}
							side="right"
							contentClass="z-[90]"
						/>
					{:else}
						{@render targetOption({ props: {} })}
					{/if}
				{/each}
			</Popover.Content>
		</Popover.Root>
	{/if}
{/snippet}

{#snippet printMenuItems()}
	<button
		type="button"
		disabled={printingTickera}
		onclick={() => {
			printOpen = false;
			onPreviewPdf();
		}}
		class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-info-container disabled:cursor-not-allowed disabled:opacity-50"
	>
		<span
			class="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
		>
			<FileText class="h-4 w-4" />
		</span>
		Ver recibo
	</button>
	<button
		type="button"
		disabled={printingTickera}
		onclick={() => {
			printOpen = false;
			onOpenPdf();
		}}
		class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-info-container disabled:cursor-not-allowed disabled:opacity-50"
	>
		<span
			class="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
		>
			<Printer class="h-4 w-4" />
		</span>
		Imprimir PDF
	</button>
	<button
		type="button"
		disabled={printingTickera}
		onclick={() => {
			printOpen = false;
			onPrintTickera();
		}}
		class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-info-container disabled:cursor-not-allowed disabled:opacity-50"
	>
		<span
			class="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
		>
			<ReceiptText class="h-4 w-4" />
		</span>
		{printingTickera ? 'Imprimiendo…' : 'Imprimir tickera'}
	</button>
{/snippet}

{#snippet cancelOption({ props }: { props: Record<string, unknown> })}
	<button
		{...hoverOnly(props)}
		type="button"
		onclick={() => {
			moreOpen = false;
			onCancel();
		}}
		class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-error-container focus-visible:outline-2 focus-visible:outline-brand-blue"
	>
		<span
			class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-error-container text-on-error-container"
		>
			<CircleX class="h-4 w-4" />
		</span>
		<span class="text-sm font-semibold text-error">Cancelar venta</span>
	</button>
{/snippet}

{#snippet moreTrigger({ props: tipProps }: { props: Record<string, unknown> })}
	<Popover.Root bind:open={moreOpen}>
		<Popover.Trigger>
			{#snippet child({ props: popProps }: { props: Record<string, unknown> })}
				<button
					{...tipProps}
					{...popProps}
					aria-label="Más acciones"
					class="hero-btn w-[46px] shrink-0 justify-center"
				>
					<EllipsisVertical class="h-4 w-4" />
				</button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content
			align="end"
			class="anim-pop z-[80] w-[250px] rounded-xl bg-white p-1.5 text-on-surface shadow-xl"
		>
			{#if showRevertOption}
				<button
					type="button"
					onclick={() => {
						moreOpen = false;
						onChangeStatus();
					}}
					class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-info-container focus-visible:outline-2 focus-visible:outline-brand-blue"
				>
					<span
						class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
					>
						<Undo2 class="h-4 w-4" />
					</span>
					<span class="text-sm font-semibold text-on-surface">Volver a estado…</span>
				</button>
				<div class="my-1.5 h-px bg-outline-variant/40"></div>
			{/if}
			<TriggerTooltip
				trigger={cancelOption}
				text="Pide motivo y decisión de reembolso"
				side="left"
				contentClass="z-[90]"
			/>
		</Popover.Content>
	</Popover.Root>
{/snippet}

<!-- ══ Fila 2: acciones + CTA ══════════════════════════════════════ -->
{#if hasActionsRow}
	<div
		class="col-start-1 row-start-2 mt-4 flex flex-nowrap items-stretch gap-2 border-t border-white/15 pt-4"
	>
		{@render statusMenu()}
		{#if showEdit}
			<button
				type="button"
				onclick={onEdit}
				class="hero-btn max-w-[260px] flex-1 basis-0 justify-center"
			>
				<Pen class="h-3.5 w-3.5" />
				Editar
			</button>
		{/if}
		{#if canPrintReceipt}
			<Popover.Root bind:open={printOpen}>
				<Popover.Trigger class="hero-btn max-w-[260px] flex-1 basis-0 justify-center">
					<Printer class="h-3.5 w-3.5" />
					Imprimir
					<ChevronDown class="h-3.5 w-3.5" />
				</Popover.Trigger>
				<Popover.Content
					align="start"
					class="anim-pop z-[80] w-[250px] rounded-xl bg-white p-1.5 text-on-surface shadow-xl"
				>
					{@render printMenuItems()}
				</Popover.Content>
			</Popover.Root>
		{/if}
		{#if showCancel}
			<TriggerTooltip trigger={moreTrigger} text="Más acciones" />
		{/if}
	</div>
{/if}

{#if showPaymentForm}
	<div class="col-start-2 row-start-2 mt-4 border-t border-white/15 pt-4">
		<button
			type="button"
			onclick={onPay}
			class="h-9 w-full justify-center rounded-lg bg-brand-gold text-[14px] font-bold text-brand-navy transition-all duration-150 hover:bg-brand-gold-dark active:scale-[.97]"
		>
			Cobrar / Registrar pago
		</button>
	</div>
{/if}

<style lang="postcss">
	/* Ghost actions over navy: stretch to fill the row (compact when the sidebar opens). */
	:global(.hero-btn) {
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 12px;
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 8px;
		background: transparent;
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		transition:
			background 0.15s var(--ds-ease-out),
			transform 0.15s var(--ds-ease-out);
	}

	:global(.hero-btn:hover) {
		background: rgba(255, 255, 255, 0.12);
	}

	:global(.hero-btn:active) {
		transform: scale(0.97);
	}

	/* Primary variant: filled brand-blue (the utility class loses to .hero-btn's
	   unlayered `background: transparent`, so the variant lives here too). */
	:global(.hero-btn-primary) {
		background: var(--color-brand-blue);
		border-color: var(--color-brand-blue);
		color: var(--color-brand-navy);
	}

	:global(.hero-btn-primary:hover) {
		background: var(--color-brand-blue-light);
		border-color: var(--color-brand-blue-light);
	}

	:global(.hero-btn:focus-visible) {
		outline: 2px solid var(--color-brand-blue);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.hero-btn) {
			transition: none;
		}
	}
</style>
