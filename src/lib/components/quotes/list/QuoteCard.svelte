<script lang="ts">
	import { resolve } from '$app/paths';
	import { CalendarX, Clock, MoreHorizontal } from '@lucide/svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import QuoteStatusBadge from './QuoteStatusBadge.svelte';
	import QuoteRowMenu from './QuoteRowMenu.svelte';
	import { relativeDaysLabel } from '$lib/components/sales/saleDisplay';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import {
		businessTodayISO,
		quoteValidity,
		quoteValidityListText
	} from '$lib/shared/quotes/quoteValidity';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import { formatQuoteNumber, formatConvertedSaleRef } from './quoteListDisplay';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';

	interface Props {
		quote: QuoteWithRelations;
		index?: number;
		/** 'comfortable' (Cuadros, rica) | 'compact' (móvil Lista, fila densa) — como `SaleCard`. */
		density?: 'comfortable' | 'compact';
		canManage: boolean;
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
		/** Móvil: el ⋯ abre la hoja inferior de acciones en vez del popover. */
		onMenu?: (quote: QuoteWithRelations) => void;
	}

	let {
		quote,
		index = 0,
		density = 'comfortable',
		canManage,
		onOpen,
		onEdit,
		onDuplicate,
		onConvert,
		onCancel,
		onMenu
	}: Props = $props();

	const today = businessTodayISO();
	const compact = $derived(density === 'compact');
	const validity = $derived(quoteValidity(quote.validUntil, quote.status as QuoteStatus, today));
	const validityText = $derived(quoteValidityListText(validity));
	const cancelled = $derived(quote.status === QuoteStatus.CANCELLED);
	const faded = $derived(cancelled ? 'opacity-[0.65]' : '');
	const customerName = $derived(
		quote.customer ? `${quote.customer.firstName} ${quote.customer.lastName}` : null
	);
</script>

{#snippet validityTag()}
	{#if quote.status === QuoteStatus.CONVERTED && quote.convertedOrderNumber}
		<span class="text-[12px] text-on-surface-variant">
			Venta <b class="font-mono text-brand-blue"
				>{formatConvertedSaleRef(quote.convertedOrderNumber)}</b
			>
		</span>
	{:else if cancelled}
		<span class="text-[12px] text-outline">—</span>
	{:else if validity.kind === 'soon' || validity.kind === 'expired'}
		<span
			class="inline-flex items-center gap-1 rounded {validity.kind === 'soon'
				? 'bg-warning-container text-on-warning-container'
				: 'bg-error-container text-on-error-container'} px-1.5 py-0.5 text-[12px] font-semibold"
		>
			{#if validity.kind === 'soon'}
				<Clock class="h-3 w-3" />
			{:else}
				<CalendarX class="h-3 w-3" />
			{/if}
			{validityText}
		</span>
	{:else if validityText}
		<span class="text-[12px] text-on-surface-variant">{validityText}</span>
	{/if}
{/snippet}

<!-- La accesibilidad la garantiza el enlace del número dentro de la tarjeta (como SaleCard). -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
	class="animate-rise cursor-pointer rounded-[var(--ds-radius-lg)] shadow-[var(--ds-shadow-sm)] transition-all duration-200 ease-out active:bg-surface-container-low {compact
		? 'p-2.5 pr-1'
		: 'p-3 hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-md)]'} {cancelled
		? 'bg-[#fbfafb]'
		: 'bg-white'}"
	style="animation-delay: {index * 30}ms"
	onclick={() => onOpen(quote)}
>
	<!-- Fila superior: # + Cashea … pill + ⋯ -->
	<div class="flex items-center gap-1.5">
		<a
			href={resolve(`/quotes/${quote.id}`)}
			onclick={(event) => event.stopPropagation()}
			class="font-mono text-[14px] font-bold text-brand-navy transition-colors hover:text-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
		>
			{formatQuoteNumber(quote.quoteNumber)}
		</a>
		{#if quote.isCashea}
			<TriggerTooltip text="Presupuesto con Cashea">
				{#snippet trigger({ props })}
					<span
						{...props}
						class="inline-flex shrink-0 items-center"
						aria-label="Presupuesto con Cashea"
					>
						<CasheaIsotipo class="h-[18px] w-[18px]" />
					</span>
				{/snippet}
			</TriggerTooltip>
		{/if}
		<span class="flex-1"></span>
		<QuoteStatusBadge status={quote.status} />
		<div class="-my-2 -mr-1">
			{#if onMenu}
				<!-- Móvil: ⋯ de 44×44 que abre la hoja inferior de acciones (no popover). -->
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onMenu(quote);
					}}
					aria-label="Más acciones para el presupuesto {formatQuoteNumber(quote.quoteNumber)}"
					class="grid h-11 w-11 place-items-center rounded-[var(--ds-radius-md)] text-brand-navy transition-colors hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
				>
					<MoreHorizontal class="h-[22px] w-[22px]" />
				</button>
			{:else}
				<div onclick={(event) => event.stopPropagation()} role="presentation">
					<QuoteRowMenu
						{quote}
						{canManage}
						{onOpen}
						{onEdit}
						{onDuplicate}
						{onConvert}
						{onCancel}
					/>
				</div>
			{/if}
		</div>
	</div>

	{#if compact}
		<!-- Fila densa (~88 px): cliente/subtítulo a la izquierda, total + validez a la derecha -->
		<div class="mt-0.5 flex items-end gap-2.5 pr-2">
			<div class="min-w-0 flex-1 {faded}">
				{#if customerName}
					<p class="truncate text-[14px] leading-tight font-semibold text-on-surface">
						{customerName}
					</p>
				{:else}
					<p class="text-[14px] leading-tight text-outline italic">Sin cliente</p>
				{/if}
				<p class="mt-0.5 truncate text-[12px] text-on-surface-variant">
					{#if quote.customer?.idNumber}
						<span class="font-mono">{quote.customer.idNumber}</span> ·
					{/if}
					{relativeDaysLabel(quote.quoteDate)}
				</p>
			</div>
			<div class="flex shrink-0 flex-col items-end gap-0.5 {faded}">
				<span class="font-heading text-[16px] font-semibold text-brand-navy tabular-nums">
					{formatPrice(quote.total)}
				</span>
				{@render validityTag()}
			</div>
		</div>
	{:else}
		<!-- Cliente + vendedor -->
		<div class="mt-1.5 {faded}">
			{#if customerName}
				<p class="text-[14px] leading-tight font-semibold">{customerName}</p>
				<p class="mt-0.5 text-[12px] text-on-surface-variant">
					<span class="font-mono">{quote.customer?.idNumber ?? ''}</span>
					{#if quote.seller?.fullName}
						· {quote.seller.fullName}
					{/if}
				</p>
			{:else}
				<p class="text-[14px] text-outline italic">Sin cliente</p>
				<p class="mt-0.5 text-[12px] text-on-surface-variant">{quote.seller?.fullName ?? ''}</p>
			{/if}
		</div>

		<!-- Separador + total / validez -->
		<div
			class="mt-2.5 flex items-end justify-between border-t border-outline-variant/50 pt-2 {faded}"
		>
			<span class="font-heading text-[17px] font-semibold text-brand-navy tabular-nums">
				{formatPrice(quote.total)}
			</span>
			{@render validityTag()}
		</div>

		<!-- Fecha del presupuesto (secundaria, bajo el total) -->
		<p class="mt-1 text-[11px] text-outline">
			{formatDateOnly(quote.quoteDate, { day: '2-digit', month: '2-digit', year: '2-digit' })}
			· {relativeDaysLabel(quote.quoteDate)}
		</p>
	{/if}
</article>
