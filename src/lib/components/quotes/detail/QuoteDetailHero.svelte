<script lang="ts">
	import '$lib/components/layout/heroNavy.css';
	import {
		ArrowRightLeft,
		ChevronDown,
		CircleCheck,
		Copy,
		EllipsisVertical,
		FileDown,
		List,
		MessageSquare,
		Pen,
		ReceiptText,
		TriangleAlert,
		UserPlus,
		UserRound
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import PopoverRoot from '$lib/components/ui/popover/popover.svelte';
	import PopoverTrigger from '$lib/components/ui/popover/popover-trigger.svelte';
	import PopoverContent from '$lib/components/ui/popover/popover-content.svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import SaleDetailHeroCustomer from '$lib/components/sales/detail/SaleDetailHeroCustomer.svelte';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import { getSaleStatusLabel } from '$lib/shared/enums';
	import { saleBalance } from '$lib/shared/saleBalance';
	import {
		computeSaleBreakdown,
		saleBreakdownRows
	} from '$lib/components/sales/detail/saleBreakdown';
	import { bsEquivalent } from '$lib/components/sales/detail/saleDetail';
	import {
		businessTodayISO,
		quoteValidity,
		quoteValidityDetailText
	} from '$lib/shared/quotes/quoteValidity';
	import { QuoteStatus, getQuoteStatusLabel } from '$lib/shared/contracts/quotes';
	import type {
		QuoteItemWithDetails,
		QuoteWithRelations
	} from '$lib/server/db/queries/quotes/types';
	import type { QuoteConversionPreview } from '$lib/shared/quotes/conversionPreview';
	import type { ConvertedSaleInfo } from '$lib/shared/quotes/convertedSale';
	import {
		formatQuoteNumber,
		formatConvertedSaleRef
	} from '$lib/components/quotes/list/quoteListDisplay';

	interface Props {
		quote: QuoteWithRelations;
		items: QuoteItemWithDetails[];
		/** Preview "Si se convierte hoy" (misma query que el modal de conversión). */
		preview: QuoteConversionPreview | null;
		/** Tasa BCV viva (el presupuesto no congela tasa; los Bs. son referenciales). */
		bcvRate: number | null;
		canAct: boolean;
		/** Venta generada (estado CONVERTED): estado y saldo reales de la venta. */
		convertedSale: ConvertedSaleInfo | null;
		onBack: () => void;
		onEdit: () => void;
		onDuplicate: () => void;
		onPrintPdf: () => void;
		onCancel: () => void;
		onConvert: () => void;
		/** Abre el modal de conversión en modo sin cliente (D5). */
		onAssignCustomer: () => void;
		onOpenHistory: () => void;
	}

	let {
		quote,
		items,
		preview,
		bcvRate,
		canAct,
		convertedSale,
		onBack,
		onEdit,
		onDuplicate,
		onPrintPdf,
		onCancel,
		onConvert,
		onAssignCustomer,
		onOpenHistory
	}: Props = $props();

	const isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	const isConverted = $derived(quote.status === QuoteStatus.CONVERTED);
	const isCancelled = $derived(quote.status === QuoteStatus.CANCELLED);

	const today = businessTodayISO();
	const validity = $derived(quoteValidity(quote.validUntil, quote.status as QuoteStatus, today));
	const validityText = $derived(quoteValidityDetailText(validity));

	const breakdown = $derived(computeSaleBreakdown(quote, items));
	const breakdownRows = $derived(saleBreakdownRows(breakdown).filter((r) => r.key !== 'total'));
	let showBreakdown = $state(false);

	const rateTooltip = $derived(
		bcvRate === null
			? 'Tasa BCV no disponible'
			: `El presupuesto no congela tasa: los Bs. usan la tasa BCV actual (${formatCurrency(bcvRate)}) como referencia y pueden variar.`
	);

	function bsLabel(amountUsd: number): string | null {
		if (bcvRate === null || bcvRate <= 0) return null;
		return `≈ Bs. ${formatCurrency(bsEquivalent(amountUsd, bcvRate) ?? 0)}`;
	}

	const outOfStockCount = $derived(
		preview?.items.filter((i) => i.stock.kind === 'insufficient').length ?? 0
	);
	const priceChangedCount = $derived(preview?.summary.priceChangedCount ?? 0);
	const missingCustomer = $derived(preview?.summary.missingCustomer ?? !quote.customer);

	// Saldo de la venta generada: helper canónico (0 en CANCELLED y con tolerancia 0.01)
	const convertedBalance = $derived(convertedSale ? saleBalance(convertedSale) : 0);

	let moreOpen = $state(false);
	const showMore = $derived(canAct && isDraft);
</script>

<section
	class="hero navy-hero relative gap-x-[28px] gap-y-0 overflow-hidden rounded-xl bg-brand-navy p-4 px-5 text-white shadow-[var(--ds-shadow-md)] [&>*]:relative [&>*]:z-[1]"
>
	<!-- ══ hl: encabezado (título + pill + stepper) ════════════════════ -->
	<div style="grid-area: hl" class="hl min-w-0">
		<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
			<a
				href={resolve('/quotes')}
				onclick={(e) => {
					e.preventDefault();
					onBack();
				}}
				class="transition-colors hover:text-white"
			>
				← Presupuestos
			</a>
			· Detalle de presupuesto
		</p>

		<div class="mt-1 mb-2 flex flex-wrap items-center gap-2.5">
			<h1 class="hero-title font-heading text-[30px] leading-none font-bold whitespace-nowrap">
				Presupuesto {formatQuoteNumber(quote.quoteNumber)}
			</h1>
			<span
				class="rounded px-2 py-[3px] text-[11px] font-bold tracking-[0.06em] uppercase {quote.status ===
				QuoteStatus.DRAFT
					? 'bg-warning-container text-on-warning-container'
					: quote.status === QuoteStatus.CONVERTED
						? 'bg-info-container text-on-info-container'
						: 'bg-error-container text-on-error-container'}"
			>
				{getQuoteStatusLabel(quote.status)}
			</span>
			{#if quote.isCashea}
				<TriggerTooltip
					text="Presupuesto con Cashea. Al convertir se copia a la venta (editable ahí)."
				>
					{#snippet trigger({ props }: { props: Record<string, unknown> })}
						<span
							{...props}
							class="inline-flex cursor-help items-center gap-1.5 rounded-lg bg-brand-gold py-[3px] pr-2.5 pl-1 text-xs font-bold text-brand-navy"
						>
							<CasheaIsotipo class="h-5 w-5" />
							Cashea
						</span>
					{/snippet}
				</TriggerTooltip>
			{/if}
		</div>

		{#if !isCancelled}
			<!-- Stepper de 2 pasos: Borrador → Convertido en venta -->
			<div
				class="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] uppercase"
			>
				<span
					class="flex items-center gap-1.5 {isConverted
						? 'text-[#c9d3ea]'
						: 'step-current text-white'}"
				>
					<i
						class="h-[9px] w-[9px] rounded-full {isConverted
							? 'bg-brand-blue'
							: 'bg-brand-gold shadow-[0_0_0_3px_rgba(252,208,30,.28)]'}"
					></i>
					<span class="step-label">Borrador</span>
				</span>
				<span class="step-link h-[2px] w-[22px] {isConverted ? 'bg-brand-blue' : 'bg-[#34456b]'}"
				></span>
				<span
					class="flex items-center gap-1.5 {isConverted
						? 'step-current text-white'
						: 'text-[#7f8caa]'}"
				>
					<i
						class="h-[9px] w-[9px] rounded-full {isConverted
							? 'bg-brand-gold shadow-[0_0_0_3px_rgba(252,208,30,.28)]'
							: 'bg-[#34456b]'}"
					></i>
					<span class="step-label">Convertido en venta</span>
				</span>
			</div>
		{/if}
	</div>

	<!-- ══ hc2: cliente + meta + nota ═════════════════════════════════ -->
	<div style="grid-area: hc2" class="hc2 min-w-0">
		<SaleDetailHeroCustomer customer={quote.customer}>
			{#snippet emptyState()}
				<div
					class="mb-2.5 flex items-center gap-3 rounded-xl border border-dashed border-white/30 bg-white/[.04] px-3.5 py-3"
				>
					<span
						class="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full border border-dashed border-white/40 text-[#9fb0d2]"
					>
						<UserRound class="h-5 w-5" />
					</span>
					<div class="min-w-0 flex-1">
						<p class="font-heading text-lg font-bold">Sin cliente asignado</p>
						<p class="text-[13px] text-[#b8c4de]">
							Presupuesto rápido. El cliente se pide al convertir a venta.
						</p>
						{#if canAct && isDraft}
							<button
								type="button"
								onclick={onAssignCustomer}
								class="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-[#9fd6ea] transition-colors hover:text-white"
							>
								<UserPlus class="h-3.5 w-3.5" />
								Asignar cliente ahora
							</button>
						{/if}
					</div>
				</div>
			{/snippet}
		</SaleDetailHeroCustomer>

		<div class="hero-meta mt-3 grid grid-cols-[repeat(3,max-content)] gap-x-[30px] gap-y-0.5">
			<div>
				<span class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase">
					Vendedor
				</span>
				<b class="block text-sm font-semibold">{quote.seller?.fullName ?? 'Sin asignar'}</b>
			</div>
			<div>
				<span class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase">
					Fecha
				</span>
				<b class="block text-sm font-semibold">
					{formatDateOnly(quote.createdAt, { dateStyle: 'medium' })}
				</b>
			</div>
			{#if isConverted && convertedSale}
				<div>
					<span
						class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase"
					>
						Convertido
					</span>
					<b class="block text-sm font-semibold">
						{formatDateOnly(convertedSale.createdAt, { dateStyle: 'medium' })}
					</b>
				</div>
			{:else}
				<div>
					<span
						class="mb-0.5 block text-[10px] font-bold tracking-[0.1em] text-[#9fb0d2] uppercase"
					>
						Válido hasta
					</span>
					{#if validity.kind === 'none'}
						<b class="block text-sm font-semibold text-[#c9d3ea]">Sin vencimiento</b>
					{:else}
						<b class="block text-sm font-semibold">
							{formatDateOnly(validity.validUntilDate ?? '', { dateStyle: 'medium' })}
						</b>
						{#if validityText && validity.kind !== 'expired'}
							<small class="block text-[11px] text-[#b8c4de]">{validityText}</small>
						{:else if validity.kind === 'expired'}
							<small class="block text-[11px] text-[#ffb4ab]">{validityText}</small>
						{/if}
					{/if}
				</div>
			{/if}
		</div>

		{#if quote.notes}
			{#snippet notesLine({ props }: { props: Record<string, unknown> })}
				<div
					{...props}
					class="mt-2.5 flex max-w-[420px] items-center gap-1.5 text-xs text-[#b8c4de]"
				>
					<MessageSquare class="h-3.5 w-3.5 shrink-0" />
					<span class="truncate">{quote.notes}</span>
				</div>
			{/snippet}
			<TriggerTooltip trigger={notesLine} text="Observaciones: {quote.notes}" />
		{/if}
	</div>

	<!-- ══ mon: dinero ════════════════════════════════════════════════ -->
	<div style="grid-area: mon" class="mon min-w-0">
		<div class="money-total min-w-0">
			<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">Total</p>
			<p class="font-heading mt-0.5 text-[32px] leading-none font-bold tabular-nums">
				{formatPrice(quote.total)}
			</p>
			{#if bsLabel(quote.total)}
				{#snippet bsTotal({ props }: { props: Record<string, unknown> })}
					<p {...props} class="cursor-help text-[13px] text-[#b8c4de] tabular-nums">
						{bsLabel(quote.total)}
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
			{#if isConverted && convertedSale}
				<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
					Venta generada
				</p>
				<a
					href={resolve(`/sales/${convertedSale.id}`)}
					onclick={(e) => {
						e.preventDefault();
						goto(resolve(`/sales/${convertedSale.id}`));
					}}
					class="font-heading mt-0.5 inline-flex cursor-pointer items-center gap-1.5 text-[26px] font-bold text-brand-gold transition-colors hover:text-brand-gold-dark"
				>
					{formatConvertedSaleRef(convertedSale.orderNumber)}
				</a>
				<p class="text-[12px] text-[#b8c4de] tabular-nums">
					{getSaleStatusLabel(convertedSale.status)} · saldo {formatPrice(convertedBalance)}
				</p>
			{:else if !isCancelled}
				<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
					Si se convierte hoy
				</p>
				<div class="mt-1.5 space-y-1 text-[13px] text-[#c9d3ea]">
					{#if missingCustomer}
						<p class="flex items-center gap-2">
							<UserRound class="h-3.5 w-3.5 text-brand-gold" />
							Falta el cliente
						</p>
					{/if}
					{#if outOfStockCount > 0}
						<p class="flex items-center gap-2">
							<TriangleAlert class="h-3.5 w-3.5 text-brand-gold" />
							{outOfStockCount}
							{outOfStockCount === 1 ? 'ítem sin stock' : 'ítems sin stock'}
						</p>
					{:else if preview}
						<p class="flex items-center gap-2">
							<CircleCheck class="h-3.5 w-3.5 text-success" />
							Stock disponible
						</p>
					{/if}
					{#if priceChangedCount > 0}
						<p class="flex items-center gap-2">
							<TriangleAlert class="h-3.5 w-3.5 text-brand-gold" />
							{priceChangedCount}
							{priceChangedCount === 1
								? 'precio cambió en catálogo'
								: 'precios cambiaron en catálogo'}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- ══ acts: acciones secundarias ═════════════════════════════════ -->
	<div
		style="grid-area: acts"
		class="hero-acts mt-4 flex min-w-0 flex-nowrap items-stretch gap-2 border-t border-white/15 pt-4"
	>
		{#if canAct && isDraft}
			<button
				type="button"
				onclick={onEdit}
				class="hero-btn max-w-[260px] flex-1 basis-0 justify-center"
			>
				<Pen class="h-3.5 w-3.5" />
				Editar
			</button>
		{/if}
		{#if canAct}
			<button
				type="button"
				onclick={onDuplicate}
				class="hero-btn max-w-[260px] flex-1 basis-0 justify-center"
			>
				<Copy class="h-3.5 w-3.5" />
				Duplicar
			</button>
		{/if}
		{#if canAct}
			<button
				type="button"
				onclick={onPrintPdf}
				class="hero-btn max-w-[260px] flex-1 basis-0 justify-center"
			>
				<FileDown class="h-3.5 w-3.5" />
				Imprimir PDF
			</button>
		{/if}
		{#if showMore}
			<PopoverRoot bind:open={moreOpen}>
				<PopoverTrigger class="hero-btn w-[46px] shrink-0 justify-center" aria-label="Más acciones">
					<EllipsisVertical class="h-4 w-4" />
				</PopoverTrigger>
				<PopoverContent
					align="end"
					class="anim-pop z-[80] w-[250px] rounded-xl bg-white p-1.5 text-on-surface shadow-xl"
				>
					<button
						type="button"
						onclick={() => {
							moreOpen = false;
							onOpenHistory();
						}}
						class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-info-container"
					>
						Ver historial
					</button>
					<div class="my-1.5 h-px bg-outline-variant/40"></div>
					<button
						type="button"
						onclick={() => {
							moreOpen = false;
							onCancel();
						}}
						class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-error transition-colors hover:bg-error-container"
					>
						Cancelar presupuesto
					</button>
				</PopoverContent>
			</PopoverRoot>
		{/if}
	</div>

	<!-- ══ hcta: CTA principal ════════════════════════════════════════ -->
	{#if canAct && isDraft}
		<div style="grid-area: hcta" class="hero-hcta mt-4 min-w-0 border-t border-white/15 pt-4">
			<button
				type="button"
				onclick={onConvert}
				class="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-gold text-[14px] font-bold text-brand-navy transition-all duration-150 hover:bg-brand-gold-dark active:scale-[.97]"
			>
				<ArrowRightLeft class="h-4 w-4" />
				Convertir a venta
			</button>
		</div>
	{:else if isConverted && convertedSale}
		<div style="grid-area: hcta" class="hero-hcta mt-4 min-w-0 border-t border-white/15 pt-4">
			<button
				type="button"
				onclick={() => goto(resolve(`/sales/${convertedSale.id}`))}
				class="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white text-[14px] font-bold text-brand-navy transition-colors hover:bg-surface"
			>
				<ReceiptText class="h-4 w-4" />
				Ver venta {formatConvertedSaleRef(convertedSale.orderNumber)}
			</button>
		</div>
	{/if}
</section>

<style>
	/* Regla de franjas (mockup 2): a ningún tamaño el contenido de hc2/acts
	   queda debajo de las franjas decorativas → padding derecho de guarda. */
	@container (min-width: 700px) {
		.hc2 {
			padding-right: 100px;
		}
		.hero-acts {
			padding-right: 130px;
		}
	}

	/* Móvil (<700): las acciones van en la barra inferior y en "Más", no aquí. */
	@container (max-width: 699px) {
		.hero-acts,
		.hero-hcta {
			display: none;
		}
	}
</style>
