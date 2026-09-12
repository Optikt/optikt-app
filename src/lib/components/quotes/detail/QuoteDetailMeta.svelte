<script lang="ts">
	import { QuoteStatusBadge } from '$lib/components/ui';
	import { formatDateOnly } from '$lib/utils';
	import { quoteCustomerIdNumber, quoteCustomerName } from './quoteDetail';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quote: QuoteWithRelations;
		formattedQuoteNumber: string;
	}

	let { quote, formattedQuoteNumber }: Props = $props();
</script>

<div class="-mt-2 flex flex-wrap items-center gap-3 text-on-surface-variant">
	<div
		class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
	>
		<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Número</span>
		<span class="font-mono text-sm font-semibold text-brand-navy">{formattedQuoteNumber}</span>
	</div>
	<div
		class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
	>
		<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Cliente</span>
		<span class="font-semibold text-brand-navy">{quoteCustomerName(quote)}</span>
		<span class="font-mono text-sm text-outline"
			>{quoteCustomerIdNumber(quote) || 'Sin documento'}</span
		>
	</div>
	<div
		class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
	>
		<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Fecha</span>
		<span class="font-semibold text-brand-navy"
			>{formatDateOnly(quote.quoteDate, { dateStyle: 'medium' })}</span
		>
	</div>
	<div
		class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
	>
		<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Vendedor</span>
		<span class="font-semibold text-brand-navy">{quote.seller?.fullName ?? 'Sin asignar'}</span>
	</div>
	{#if quote.validUntil}
		<div
			class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3.5 py-2.5 text-sm shadow-sm"
		>
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
				>Válido hasta</span
			>
			<span class="font-semibold text-brand-navy"
				>{formatDateOnly(quote.validUntil, { dateStyle: 'medium' })}</span
			>
		</div>
	{/if}
	<div class="inline-flex items-center rounded-xl bg-surface-container-low px-3 py-2 shadow-sm">
		<QuoteStatusBadge status={quote.status} />
	</div>
</div>
