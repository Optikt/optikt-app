<script lang="ts">
	import {
		Calculator,
		ChevronDown,
		ExternalLink,
		IdCard,
		MapPin,
		MessageSquare,
		Phone
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { logger } from '$lib/utils/logger';
	import { CasheaIsotipo } from '$lib/components/branding';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		CUSTOMER_GENDER_LABELS,
		RefundStatus,
		SaleStatus,
		SALE_STATUS_LABELS,
		type CustomerGender
	} from '$lib/shared/enums';
	import { calculateAge } from '$lib/dates';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import { computeSaleBreakdown, saleBreakdownRows } from './saleBreakdown';
	import {
		SALE_STATUS_FLOW,
		bsEquivalent,
		customerInitials,
		resolveSaleRateDisplay,
		saleStatusLabel,
		saleStatusPillClasses
	} from './saleDetail';
	import SaleDetailHeroActions from './SaleDetailHeroActions.svelte';

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

	// ── Customer ──────────────────────────────────────────────────────────
	const customer = $derived(sale.customer);
	const customerName = $derived(
		customer ? `${customer.firstName} ${customer.lastName}` : 'Cliente no asignado'
	);
	const initials = $derived(customerInitials(customerName));
	const age = $derived(customer ? calculateAge(customer.birthDate) : null);
	const genderLabel = $derived(
		customer?.gender ? (CUSTOMER_GENDER_LABELS[customer.gender as CustomerGender] ?? null) : null
	);

	async function copyValue(value: string, message: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(message);
		} catch (error) {
			logger.error('No se pudo copiar al portapapeles', error);
			toast.error('No se pudo copiar');
		}
	}

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
	class="relative grid grid-cols-[1fr_290px] gap-x-[28px] gap-y-0 overflow-hidden rounded-xl bg-brand-navy p-4 px-5 text-white shadow-[var(--ds-shadow-md)] before:absolute before:-top-[10px] before:right-[338px] before:-bottom-[10px] before:w-[34px] before:-skew-x-20 before:bg-brand-blue before:opacity-90 before:content-[''] after:absolute after:-top-[10px] after:right-[384px] after:-bottom-[10px] after:w-[10px] after:-skew-x-20 after:bg-brand-gold after:content-[''] [&>*]:relative [&>*]:z-[1]"
>
	<!-- ══ Columna izquierda: información ══════════════════════════════ -->
	<div class="col-start-1 row-start-1 min-w-0">
		<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
			<a href={resolve('/sales')} onclick={handleBack} class="transition-colors hover:text-white"
				>← Ventas</a
			>
			· Detalle de venta
		</p>

		<div class="mt-1 mb-2 flex flex-wrap items-center gap-2.5">
			<h1 class="font-heading text-[30px] leading-none font-bold whitespace-nowrap">
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
							class="h-[2px] w-[22px] {i <= currentStepIndex ? 'bg-brand-blue' : 'bg-[#34456b]'}"
						></span>
					{/if}
					<span
						class="flex items-center gap-1.5 {i < currentStepIndex
							? 'text-[#c9d3ea]'
							: i === currentStepIndex
								? 'text-white'
								: 'text-[#7f8caa]'}"
					>
						<i
							class="h-[9px] w-[9px] rounded-full {i < currentStepIndex
								? 'bg-brand-blue'
								: i === currentStepIndex
									? 'bg-brand-gold shadow-[0_0_0_3px_rgba(252,208,30,.28)]'
									: 'bg-[#34456b]'}"
						></i>
						{SALE_STATUS_LABELS[step]}
					</span>
				{/each}
			</div>
		{/if}

		{#if customer}
			<div
				class="mb-2.5 flex items-start gap-3 rounded-xl border border-white/15 bg-white/[.07] px-3.5 py-2.5"
			>
				<span
					class="font-heading grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-brand-blue text-[15px] font-bold text-brand-navy"
				>
					{initials}
				</span>
				<div class="min-w-0">
					{#snippet nameLink({ props }: { props: Record<string, unknown> })}
						<a
							{...props}
							href={resolve(`/customers/${customer.id}`)}
							class="font-heading inline-flex items-center gap-1.5 border-b border-dotted border-white/40 text-lg font-bold transition-colors hover:border-white"
						>
							{customerName}
							<ExternalLink class="h-3.5 w-3.5" />
						</a>
					{/snippet}
					<TriggerTooltip trigger={nameLink} text="Ver ficha del cliente" />

					<div class="mt-1.5 flex flex-wrap items-center gap-2">
						{#if customer.idNumber}
							{#snippet cedulaChip({ props }: { props: Record<string, unknown> })}
								<button
									{...props}
									type="button"
									class="inline-flex cursor-copy items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-[3px] text-[13px] font-semibold transition-colors hover:bg-white/25"
									onclick={() => copyValue(customer.idNumber ?? '', 'Cédula copiada')}
								>
									<IdCard class="h-3.5 w-3.5" />
									{customer.idNumber}
								</button>
							{/snippet}
							<TriggerTooltip trigger={cedulaChip} text="Clic para copiar la cédula" />
						{/if}
						{#if customer.primaryPhone}
							{#snippet phoneChip({ props }: { props: Record<string, unknown> })}
								<button
									{...props}
									type="button"
									class="inline-flex cursor-copy items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-[3px] text-[13px] font-semibold transition-colors hover:bg-white/25"
									onclick={() => copyValue(customer.primaryPhone ?? '', 'Teléfono copiado')}
								>
									<Phone class="h-3.5 w-3.5" />
									{customer.primaryPhone}
								</button>
							{/snippet}
							<TriggerTooltip trigger={phoneChip} text="Clic para copiar el teléfono" />
						{/if}
						{#if age !== null}
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-white/[.07] px-2 py-[3px] text-xs font-semibold text-[#c9d3ea]"
							>
								{age} años
							</span>
						{/if}
						{#if genderLabel}
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-white/[.07] px-2 py-[3px] text-xs font-semibold text-[#c9d3ea]"
							>
								{genderLabel}
							</span>
						{/if}
					</div>
					{#if customer.address}
						{#snippet addressLine({ props }: { props: Record<string, unknown> })}
							<div
								{...props}
								class="mt-1.5 flex max-w-[470px] items-center gap-1.5 text-xs text-[#c9d3ea]"
							>
								<MapPin class="h-3.5 w-3.5 shrink-0" />
								<span class="truncate">{customer.address}</span>
							</div>
						{/snippet}
						<TriggerTooltip trigger={addressLine} text={customer.address} />
					{/if}
				</div>
			</div>
		{:else}
			<div
				class="mb-2.5 flex items-center gap-3 rounded-xl border border-white/15 bg-white/[.07] px-3.5 py-2.5"
			>
				<span
					class="font-heading grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-white/15 text-[15px] font-bold text-[#c9d3ea]"
				>
					—
				</span>
				<p class="text-sm font-semibold text-[#c9d3ea]">Cliente no asignado</p>
			</div>
		{/if}

		<div class="mt-3 grid grid-cols-[repeat(3,max-content)] gap-x-[30px] gap-y-0.5">
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

	<!-- ══ Columna derecha: dinero ═════════════════════════════════════ -->
	<div class="col-start-2 row-start-1 border-l border-white/15 pl-[24px]">
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

		<div class="mt-2 flex items-center gap-3">
			<button
				type="button"
				onclick={() => (showBreakdown = !showBreakdown)}
				class="inline-flex items-center gap-1 py-0.5 text-xs font-semibold text-[#9fd6ea] transition-colors hover:text-white"
			>
				Desglose
				<ChevronDown
					class="h-3 w-3 transition-transform duration-200 {showBreakdown ? 'rotate-180' : ''}"
				/>
			</button>
			{#if onCalculate}
				{#snippet calcTrigger({ props }: { props: Record<string, unknown> })}
					<button
						{...props}
						type="button"
						onclick={onCalculate}
						class="inline-flex cursor-help items-center gap-1 py-0.5 text-xs font-semibold text-[#9fd6ea] transition-colors hover:text-white"
					>
						<Calculator class="h-3 w-3" />
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
			class="grid transition-[grid-template-rows] duration-300 {showBreakdown
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

		<div class="mt-3 border-t border-white/20 pt-3">
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
				<div class="mt-1 mb-2.5 flex justify-between text-xs text-[#c9d3ea]">
					<span class="tabular-nums">{formatPrice(paidAmountBcvUsd)} cubierto</span>
					<span>{Math.round(paymentProgressPercent)}%</span>
				</div>
			{:else}
				<p class="text-[11px] font-bold tracking-[0.12em] text-[#b8c4de] uppercase">
					Estado de pago
				</p>
				<p class="font-heading text-[28px] leading-none font-bold text-[#62d49a]">Pagado</p>
				<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
					<div class="h-full w-full rounded-full bg-[#62d49a]"></div>
				</div>
				<div class="mt-1 mb-2.5 flex justify-between text-xs text-[#c9d3ea]">
					<span class="tabular-nums">{formatPrice(paidAmountBcvUsd)} cubierto</span>
					<span>100%</span>
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
