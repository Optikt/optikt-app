<script lang="ts">
	import { resolve } from '$app/paths';
	import QuoteStatusBadge from './QuoteStatusBadge.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
	import QuoteRowMenu from './QuoteRowMenu.svelte';
	import { relativeDaysLabel } from '$lib/components/sales/saleDisplay';
	import { formatQuoteNumber, formatConvertedSaleRef, validityClasses } from './quoteListDisplay';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import {
		quoteValidity,
		quoteValidityListText,
		businessTodayISO,
		type QuoteValidity
	} from '$lib/shared/quotes/quoteValidity';
	import { QuoteStatus, getQuoteStatusLabel } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';

	interface Props {
		quotes: QuoteWithRelations[];
		canManage: boolean;
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
	}

	let { quotes, canManage, onOpen, onEdit, onDuplicate, onConvert, onCancel }: Props = $props();

	const headerCell =
		'px-3 py-1 text-left text-[11px] leading-tight font-bold tracking-[0.06em] uppercase text-on-surface-variant';
	const cell = 'px-3 align-middle';

	function customerName(quote: QuoteWithRelations): string {
		if (!quote.customer) return 'Sin cliente';
		return `${quote.customer.firstName} ${quote.customer.lastName}`;
	}

	function initials(fullName: string): string {
		return (
			fullName
				.split(' ')
				.filter(Boolean)
				.slice(0, 2)
				.map((chunk) => chunk[0]?.toUpperCase() ?? '')
				.join('') || '?'
		);
	}

	const today = businessTodayISO();

	function validityOf(quote: QuoteWithRelations): QuoteValidity {
		return quoteValidity(quote.validUntil, quote.status as QuoteStatus, today);
	}
</script>

<table class="w-full table-fixed border-collapse" aria-label="Listado de presupuestos">
	<thead>
		<tr class="h-[30px] border-b border-outline-variant/70 bg-surface-container-low">
			<th class="{headerCell} w-[110px]">#</th>
			<th class={headerCell}>Cliente</th>
			<th class="{headerCell} w-[96px]">Fecha</th>
			<th class="{headerCell} w-[100px] text-right">Total</th>
			<th class="{headerCell} w-[170px]">Validez</th>
			<th class="{headerCell} w-[124px]">Estado</th>
			<th class="{headerCell} hidden w-[150px] @min-[1130px]:table-cell">Vendedor</th>
			<th class="{headerCell} w-[44px] text-right">
				<span class="sr-only">Acciones</span>
			</th>
		</tr>
	</thead>

	<tbody class="divide-y divide-outline-variant/40">
		{#each quotes as quote, index (quote.id)}
			{@const validity = validityOf(quote)}
			{@const faded = quote.status === QuoteStatus.CANCELLED ? 'opacity-60' : ''}
			<tr
				class="animate-rise h-[58px] cursor-pointer bg-white transition-colors duration-150 hover:bg-surface-container-low {faded}"
				style="animation-delay: {index * 25}ms"
				onclick={() => onOpen(quote)}
			>
				<!-- # presupuesto + Cashea -->
				<td class={cell}>
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
					</div>
				</td>

				<!-- Cliente -->
				<td class={cell}>
					{#if quote.customer}
						<p class="text-[14px] leading-tight font-semibold text-on-surface">
							{customerName(quote)}
						</p>
						{#if quote.customer.idNumber}
							<p class="mt-0.5 font-mono text-[12px] text-on-surface-variant">
								{quote.customer.idNumber}
							</p>
						{/if}
					{:else}
						<p class="text-[14px] text-outline italic">Sin cliente</p>
					{/if}
				</td>

				<!-- Fecha -->
				<td class={cell}>
					<p class="text-[13px] whitespace-nowrap text-on-surface tabular-nums">
						{formatDateOnly(quote.createdAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}
					</p>
					<p class="mt-0.5 text-[11px] whitespace-nowrap text-outline">
						{relativeDaysLabel(quote.createdAt)}
					</p>
				</td>

				<!-- Total -->
				<td class="{cell} text-right">
					<span class="font-heading text-[15px] font-semibold text-brand-navy tabular-nums">
						{formatPrice(quote.total)}
					</span>
				</td>

				<!-- Validez (derivada al leer, D3) -->
				<td class={cell}>
					{#if quote.status === QuoteStatus.CONVERTED && quote.convertedOrderNumber}
						<span class="inline-flex items-center gap-1.5 text-[13px] text-on-surface-variant">
							Venta
							<a
								href={resolve(`/sales/${quote.conversionSaleId ?? ''}`)}
								onclick={(event) => event.stopPropagation()}
								class="font-mono font-bold text-brand-blue hover:underline"
							>
								{formatConvertedSaleRef(quote.convertedOrderNumber)}
							</a>
						</span>
					{:else if quote.status === QuoteStatus.CANCELLED}
						<span class="text-[13px] text-outline">—</span>
					{:else if quoteValidityListText(validity)}
						<span class={validityClasses(validity.kind)}>
							{quoteValidityListText(validity)}
						</span>
					{/if}
				</td>

				<!-- Estado -->
				<td class={cell}>
					<QuoteStatusBadge
						status={quote.status}
						label={getQuoteStatusLabel(quote.status)}
						class="whitespace-nowrap"
					/>
				</td>

				<!-- Vendedor (solo con ancho suficiente) -->
				<td class="{cell} hidden @min-[1130px]:table-cell">
					<div class="flex items-center gap-2">
						<span
							class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
						>
							{initials(quote.seller?.fullName ?? '')}
						</span>
						<span class="truncate text-[13px] text-on-surface-variant">
							{quote.seller?.fullName ?? '-'}
						</span>
					</div>
				</td>

				<!-- Acciones -->
				<td class="{cell} text-right">
					<div class="flex justify-end">
						<QuoteRowMenu {quote} {canManage} {onEdit} {onDuplicate} {onConvert} {onCancel} />
					</div>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
