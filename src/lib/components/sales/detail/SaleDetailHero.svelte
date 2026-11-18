<script lang="ts">
	import '$lib/components/layout/heroNavy.css';
	import { Calculator, ChevronDown, List, MessageSquare } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { CasheaIsotipo } from '$lib/components/branding';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { RefundStatus, SaleStatus, SALE_STATUS_LABELS } from '$lib/shared/enums';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import { computeSaleBreakdown, saleBreakdownRows } from './saleBreakdown';
	import {
		SALE_STATUS_FLOW,
		bsEquivalent,
		resolveSaleRateDisplay,
		saleStatusLabel,
		saleStatusPillClasses
	} from './saleDetail';
	import SaleDetailHeroActions from './SaleDetailHeroActions.svelte';
	import SaleDetailHeroCustomer from './SaleDetailHeroCustomer.svelte';

	interface Props {
		sale: SaleWithRelations;
		items: SaleItemWithDetails[];
		formattedOrderNumber: string;
		/** Live BCV rate from the store (SSE). Fallback when the sale has no snapshot. */
		bcvRate: number;
		/** Any role except VIEWER (payment form, cost editing). */
		canAct: boolean;
		/** ADMIN/MANAGER always; SELLER only own sales (canManageSaleByOwner). */
		canManageSale: boolean;
		isAdmin: boolean;
		remainingBcvUsd: number;
		paidAmountBcvUsd: number;
		paymentProgressPercent: number;
		printingTickera: boolean;
		onBack: () => void;
		onChangeStatus: (target?: SaleStatus) => void;
		onEdit: () => void;
		onPreviewPdf: () => void;
		onOpenPdf: () => void;
		onPrintTickera: () => void;
		onCancel: () => void;
		onPay: () => void;
		/** Wired in the calculator phase; the trigger hides until provided. */
		onCalculate?: () => void;
	}

	let {
		sale,
		items,
		formattedOrderNumber,
		bcvRate,
		canAct,
		canManageSale,
		isAdmin,
		remainingBcvUsd,
		paidAmountBcvUsd,
		paymentProgressPercent,
		printingTickera,
		onBack,
		onChangeStatus,
		onEdit,
		onPreviewPdf,
		onOpenPdf,
		onPrintTickera,
		onCancel,
		onPay,
		onCalculate
	}: Props = $props();

	// ── Status ────────────────────────────────────────────────────────────
	const isCancelled = $derived(sale.status === SaleStatus.CANCELLED);

	// ── Money ─────────────────────────────────────────────────────────────
	const breakdown = $derived(computeSaleBreakdown(sale, items));
	/** Hero desglose: canonical rows minus "Total" (the big number is the headline). */
	const breakdownRows = $derived(saleBreakdownRows(breakdown).filter((r) => r.key !== 'total'));
	let showBreakdown = $state(false);

	const rateDisplay = $derived(resolveSaleRateDisplay(sale.snapshotBcvRate, bcvRate));
	const rate = $derived(rateDisplay.rate);
	const rateSublabel = $derived(rateDisplay.isSnapshot ? 'de la venta' : 'actual · referencial');
	const rateTooltip = $derived(
		rate === null
			? 'Tasa BCV no disponible'
			: rateDisplay.isSnapshot
				? `Tasa BCV de la venta: ${formatCurrency(rate)}. Referencial: cada abono usa su propia tasa congelada.`
				: `Esta venta no guardó tasa. Se usa la tasa BCV actual (${formatCurrency(rate)}) como referencia: puede variar. Cada abono usa su propia tasa congelada.`
	);

	function bsLabel(amountUsd: number): string | null {
		const value = bsEquivalent(amountUsd, rate);
		if (value === null) return null;
		return `${rateDisplay.approximate ? '≈ ' : ''}Bs. ${formatCurrency(value)}`;
	}

	// ── Status stepper ────────────────────────────────────────────────────
	const currentStepIndex = $derived(
		SALE_STATUS_FLOW.indexOf(sale.status as (typeof SALE_STATUS_FLOW)[number])
	);

	// ── Customer (panel propio `hc2`, ver SaleDetailHeroCustomer) ─────────
	const customer = $derived(sale.customer);

	function handleBack(event: MouseEvent) {
		event.preventDefault();
		onBack();
	}
</script>

{#snippet casheaTrigger({ props }: { props: Record<string, unknown> })}
	<span
		{...props}
		class="inline-flex cursor-help items-center gap-1.5 rounded-lg bg-brand-gold py-[3px] pr-2.5 pl-1 text-xs font-bold text-brand-navy"
	>
		<CasheaIsotipo class="h-5 w-5" />
		Cashea
	</span>
{/snippet}

<section
	class="hero relative gap-x-[28px] gap-y-0 overflow-hidden rounded-xl bg-brand-navy p-4 px-5 text-white shadow-[var(--ds-shadow-md)] [&>*]:relative [&>*]:z-[1]"
>
	<!-- ══ hl: encabezado (título + stepper) ═══════════════════════════ -->
	<div style="grid-area: hl" class="hl min-w-0">
		<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
			<a href={resolve('/sales')} onclick={handleBack} class="transition-colors hover:text-white"
				>← Ventas</a
			>
			· Detalle de venta
		</p>

		<div class="mt-1 mb-2 flex flex-wrap items-center gap-2.5">
			<h1 class="hero-title font-heading text-[30px] leading-none font-bold whitespace-nowrap">
				Venta {formattedOrderNumber}
			</h1>
			<span
				class="rounded px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] uppercase {saleStatusPillClasses(
					sale.status
				)}"
			>
				{saleStatusLabel(sale.status)}
			</span>
			{#if sale.isCashea}
				<TriggerTooltip
					trigger={casheaTrigger}
					text="Compra con Cashea (cuotas). Se edita desde «Editar»."
				/>
			{/if}
		</div>

		{#if !isCancelled}
			<div
				class="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] uppercase"
			>
				{#each SALE_STATUS_FLOW as step, i (step)}
					{#if i > 0}
						<span
							class="step-link h-[2px] w-[22px] {i <= currentStepIndex
								? 'bg-brand-blue'
								: 'bg-[#34456b]'}"
						></span>
					{/if}
					<span
						class="flex items-center gap-1.5 {i < currentStepIndex
							? 'text-[#c9d3ea]'
							: i === currentStepIndex
								? 'step-current text-white'
								: 'text-[#7f8caa]'}"
					>
						<i
							class="h-[9px] w-[9px] rounded-full {i < currentStepIndex
								? 'bg-brand-blue'
								: i === currentStepIndex
									? 'bg-brand-gold shadow-[0_0_0_3px_rgba(252,208,30,.28)]'
									: 'bg-[#34456b]'}"
						></i>
						<span class="step-label">{SALE_STATUS_LABELS[step]}</span>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ══ hc2: cliente + meta (hijo propio del hero, área "hc2") ═══════ -->
	<div style="grid-area: hc2" class="hc2 min-w-0">
		<SaleDetailHeroCustomer {customer} />

		<div class="hero-meta mt-3 grid grid-cols-[repeat(3,max-content)] gap-x-[30px] gap-y-0.5">
			<div>
				<span class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase"
					>Vendedor</span
				>
				<b class="block text-sm font-semibold">{sale.seller?.fullName ?? 'Sin asignar'}</b>
			</div>
			<div>
				<span class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase"
					>Fecha</span
				>
				<b class="block text-sm font-semibold"
					>{formatDateOnly(sale.saleDate, { dateStyle: 'medium' })}</b
				>
			</div>
			{#if rate !== null}
				{#snippet rateValue({ props }: { props: Record<string, unknown> })}
					<div {...props}>
						<span
							class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase"
							>Tasa BCV</span
						>
						<b class="font-heading block text-sm font-semibold">{formatCurrency(rate)}</b>
						<small class="block text-[11px] text-[#b8c4de]">{rateSublabel}</small>
					</div>
				{/snippet}
				<TriggerTooltip trigger={rateValue} text={rateTooltip} />
			{/if}
		</div>

		{#if sale.notes}
			{#snippet notesLine({ props }: { props: Record<string, unknown> })}
				<div
					{...props}
					class="mt-2.5 flex max-w-[420px] items-center gap-1.5 text-xs text-[#b8c4de]"
				>
					<MessageSquare class="h-3.5 w-3.5 shrink-0" />
					<span class="truncate">{sale.notes}</span>
				</div>
			{/snippet}
			<TriggerTooltip trigger={notesLine} text="Observaciones: {sale.notes}" />
		{/if}
	</div>

	<!-- ══ mon: dinero ════════════════════════════════════════════════ -->
	<div style="grid-area: mon" class="mon min-w-0">
		<div class="money-total min-w-0">
			<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">Total</p>
			<p class="font-heading mt-0.5 text-[32px] leading-none font-bold tabular-nums">
				{formatPrice(sale.total)}
			</p>
			{#if bsLabel(sale.total)}
				{#snippet bsTotal({ props }: { props: Record<string, unknown> })}
					<p {...props} class="cursor-help text-[13px] text-[#b8c4de] tabular-nums">
						{bsLabel(sale.total)}
					</p>
				{/snippet}
				<TriggerTooltip trigger={bsTotal} text={rateTooltip} />
			{/if}
		</div>

		<div class="money-tools mt-2 flex items-center gap-3">
			<button
				type="button"
				onclick={() => (showBreakdown = !showBreakdown)}
				aria-expanded={showBreakdown}
				class="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-white transition-colors duration-150 hover:bg-white/20"
			>
				<List class="h-3.5 w-3.5" />
				Desglose
				<ChevronDown
					class="h-3.5 w-3.5 transition-transform duration-200 {showBreakdown ? 'rotate-180' : ''}"
				/>
			</button>
			{#if onCalculate}
				{#snippet calcTrigger({ props }: { props: Record<string, unknown> })}
					<button
						{...props}
						type="button"
						onclick={onCalculate}
						class="inline-flex cursor-help items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-white transition-colors duration-150 hover:bg-white/20"
					>
						<Calculator class="h-3.5 w-3.5" />
						Calcular factura
					</button>
				{/snippet}
				<TriggerTooltip
					trigger={calcTrigger}
					text="Calcula la factura manual con la tasa que elijas. Es solo una ayuda, no es fiscal."
				/>
			{/if}
		</div>

		<div
			class="money-breakdown grid transition-[grid-template-rows] duration-300 {showBreakdown
				? 'grid-rows-[1fr]'
				: 'grid-rows-[0fr]'}"
		>
			<div class="overflow-hidden">
				<div class="pt-1">
					{#each breakdownRows as row (row.key)}
						<div class="flex items-baseline justify-between gap-2 py-0.5 text-xs text-[#c9d3ea]">
							<span>{row.label}</span>
							<span class="font-semibold tabular-nums">{formatPrice(row.amount)}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="money-balance mt-3 border-t border-white/20 pt-3">
			{#if isCancelled}
				{#if sale.refundStatus && sale.refundStatus !== RefundStatus.NO_PAYMENT && sale.refundAmount !== null}
					<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
						{sale.refundStatus === RefundStatus.REFUNDED ? 'Reembolsado' : 'Depósito retenido'}
					</p>
					<p class="font-heading text-[28px] leading-none font-bold text-[#ffb4ab] tabular-nums">
						{formatPrice(sale.refundAmount)}
					</p>
					{#if bsLabel(sale.refundAmount)}
						<p class="mt-1 text-[13px] text-[#b8c4de] tabular-nums">{bsLabel(sale.refundAmount)}</p>
					{/if}
				{/if}
			{:else if remainingBcvUsd > 0.01}
				<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
					Saldo pendiente
				</p>
				<p class="font-heading text-[28px] leading-none font-bold text-brand-gold tabular-nums">
					{formatPrice(remainingBcvUsd)}
				</p>
				{#if bsLabel(remainingBcvUsd)}
					{#snippet bsSaldo({ props }: { props: Record<string, unknown> })}
						<p {...props} class="mt-0.5 cursor-help text-[13px] text-[#b8c4de] tabular-nums">
							{bsLabel(remainingBcvUsd)}
						</p>
					{/snippet}
					<TriggerTooltip trigger={bsSaldo} text={rateTooltip} />
				{/if}
				<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
					<div
						class="h-full rounded-full bg-brand-gold transition-[width] duration-700"
						style="width: {Math.min(100, Math.max(0, paymentProgressPercent))}%"
					></div>
				</div>
				<div class="mt-1 mb-2.5 flex flex-wrap justify-between gap-x-2 text-xs text-[#c9d3ea]">
					<span class="whitespace-nowrap tabular-nums"
						>{formatPrice(paidAmountBcvUsd)} cubierto</span
					>
					<span class="shrink-0 tabular-nums">{Math.round(paymentProgressPercent)}%</span>
				</div>
			{:else}
				<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
					Estado de pago
				</p>
				<p class="font-heading text-[28px] leading-none font-bold text-[#62d49a]">Pagado</p>
				<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
					<div class="h-full w-full rounded-full bg-[#62d49a]"></div>
				</div>
				<div class="mt-1 mb-2.5 flex flex-wrap justify-between gap-x-2 text-xs text-[#c9d3ea]">
					<span class="whitespace-nowrap tabular-nums"
						>{formatPrice(paidAmountBcvUsd)} cubierto</span
					>
					<span class="shrink-0">100%</span>
				</div>
			{/if}
		</div>
	</div>

	<SaleDetailHeroActions
		{sale}
		{canAct}
		{canManageSale}
		{isAdmin}
		{remainingBcvUsd}
		{printingTickera}
		{onChangeStatus}
		{onEdit}
		{onPreviewPdf}
		{onOpenPdf}
		{onPrintTickera}
		{onCancel}
		{onPay}
	/>
</section>
