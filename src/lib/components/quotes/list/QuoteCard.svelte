<script lang="ts">
	import { resolve } from '$app/paths';
	import { CalendarX, Clock } from '@lucide/svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
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
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quote: QuoteWithRelations;
		index?: number;
		canManage: boolean;
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
	}

	let {
		quote,
		index = 0,
		canManage,
		onOpen,
		onEdit,
		onDuplicate,
		onConvert,
		onCancel
	}: Props = $props();

	const today = businessTodayISO();
	const validity = $derived(quoteValidity(quote.validUntil, quote.status as QuoteStatus, today));
	const validityText = $derived(quoteValidityListText(validity));
	const faded = $derived(quote.status === QuoteStatus.CANCELLED ? 'opacity-60' : '');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	class="animate-rise rounded-xl bg-white p-3 shadow-[var(--ds-shadow-sm)] {faded}"
	style="animation-delay: {index * 25}ms"
	onclick={() => onOpen(quote)}
>
	<!-- Fila superior: # + Cashea + pill + ⋯ -->
	<div class="flex items-center gap-1.5">
		<a
			href={resolve(`/quotes/${quote.id}`)}
			onclick={(event) => event.stopPropagation()}
			class="font-mono text-[14px] font-bold text-brand-navy"
		>
			{formatQuoteNumber(quote.quoteNumber)}
		</a>
		{#if quote.isCashea}
			<CasheaIsotipo class="h-[18px] w-[18px]" />
		{/if}
		<span class="flex-1"></span>
		<QuoteStatusBadge status={quote.status} />
		<div onclick={(event) => event.stopPropagation()} role="presentation">
			<QuoteRowMenu {quote} {canManage} {onEdit} {onDuplicate} {onConvert} {onCancel} />
		</div>
	</div>

	<!-- Cliente + vendedor -->
	<div class="mt-1.5">
		{#if quote.customer}
			<p class="text-[14px] leading-tight font-semibold">
				{quote.customer.firstName}
				{quote.customer.lastName}
			</p>
			<p class="mt-0.5 text-[12px] text-on-surface-variant">
				<span class="font-mono">{quote.customer.idNumber ?? ''}</span>
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
	<div class="mt-2.5 flex items-end justify-between border-t border-outline-variant/50 pt-2">
		<span class="font-heading text-[17px] font-semibold text-brand-navy tabular-nums">
			{formatPrice(quote.total)}
		</span>
		{#if quote.status === QuoteStatus.CONVERTED && quote.convertedOrderNumber}
			<span class="text-[12px] text-on-surface-variant">
				Venta <b class="font-mono text-brand-blue"
					>{formatConvertedSaleRef(quote.convertedOrderNumber)}</b
				>
			</span>
		{:else if quote.status === QuoteStatus.CANCELLED}
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
	</div>

	<!-- Fecha (secundaria, bajo el total) -->
	<p class="mt-1 text-[11px] text-outline">
		{formatDateOnly(quote.createdAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}
		· {relativeDaysLabel(quote.createdAt)}
	</p>
</div>
