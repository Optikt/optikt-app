<script lang="ts">
	import { ChevronDown, FileText, ExternalLink } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { slide } from 'svelte/transition';
	import { QuoteStatusBadge } from '$lib/components/ui/badges';
	import { formatDate, formatCurrency } from '$lib/utils';
	import { SALE_ITEM_TYPE_LABELS } from '$lib/shared/enums/lensTypes';
	import type { HistoryQuote } from '$lib/server/db/queries/customerHistory';

	interface Props {
		quotes: HistoryQuote[];
	}

	let { quotes }: Props = $props();

	let expandedQuoteId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedQuoteId = expandedQuoteId === id ? null : id;
	}

	function scrollIntoView(e: Event) {
		(e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	function getItemTypeLabel(type: string): string {
		return SALE_ITEM_TYPE_LABELS[type as keyof typeof SALE_ITEM_TYPE_LABELS] ?? type;
	}
</script>

{#if quotes.length > 0}
	<div class="space-y-3">
		{#each quotes as quote (quote.id)}
			{@const isExpanded = expandedQuoteId === quote.id}
			<div
				class="overflow-hidden rounded-xl border border-outline-variant/30 transition-colors {isExpanded
					? 'border-brand-blue/30'
					: ''}"
			>
				<!-- Quote header row -->
				<button
					type="button"
					onclick={() => toggleExpand(quote.id)}
					class="flex w-full items-center justify-between bg-surface-container-lowest px-5 py-4 text-left transition-colors hover:bg-surface-container-low"
				>
					<div class="flex items-center gap-4">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-mono text-sm font-semibold text-on-surface">
									P-{String(quote.quoteNumber).padStart(4, '0')}
								</span>
								<QuoteStatusBadge status={quote.status} />
							</div>
							<p class="mt-0.5 text-xs text-on-surface-variant">
								{formatDate(quote.quoteDate, { month: 'short' })}
								{#if quote.seller}
									<span class="text-outline">·</span>
									{quote.seller.fullName}
								{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-4">
						<div class="text-right">
							<p class="font-mono text-sm font-semibold text-on-surface">
								${formatCurrency(quote.total)}
							</p>
							{#if quote.validUntil}
								<p class="text-xs text-on-surface-variant">
									Válido: {formatDate(quote.validUntil, { month: 'short' })}
								</p>
							{/if}
						</div>
						<div class="transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}">
							<ChevronDown class="h-4 w-4 text-on-surface-variant" />
						</div>
					</div>
				</button>

				<!-- Expanded detail -->
				{#if isExpanded}
					<div
						transition:slide={{ duration: 200 }}
						onintroend={scrollIntoView}
						class="border-t border-outline-variant/20 bg-surface-container-low px-5 py-4"
					>
						<!-- Items -->
						{#if quote.items.length > 0}
							<div class="mb-4">
								<h4
									class="mb-2 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase"
								>
									Ítems ({quote.items.length})
								</h4>
								<div class="space-y-1.5">
									{#each quote.items as item (item.id)}
										<div
											class="flex items-center justify-between rounded-lg bg-surface-container-lowest px-3 py-2"
										>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium text-on-surface">
													{item.displayName}
												</p>
												<p class="text-xs text-on-surface-variant">
													{getItemTypeLabel(item.itemType)}
													{#if item.snapshotBrand}
														<span class="text-outline">·</span>
														{item.snapshotBrand}
													{/if}
												</p>
											</div>
											<div class="ml-3 shrink-0 text-right">
												<span class="font-mono text-sm text-on-surface">
													{item.quantity} × ${formatCurrency(item.unitPrice)}
												</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if quote.conversionSaleId}
							<!-- eslint-disable-next-line svelte/valid-compile -->
							<a
								href={resolve(`/sales/${quote.conversionSaleId}` as '/')}
								class="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/20"
							>
								Ver venta generada
								<ExternalLink class="h-3 w-3" />
							</a>
						{/if}

						<!-- Link to full quote -->
						<!-- eslint-disable-next-line svelte/valid-compile -->
						<a
							href={resolve(`/quotes/${quote.id}` as '/')}
							class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue transition-colors hover:text-brand-blue/80"
						>
							Ver presupuesto completo
							<ExternalLink class="h-3 w-3" />
						</a>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-10 text-center">
		<FileText class="mb-2 h-8 w-8 text-outline/40" />
		<p class="text-sm text-on-surface-variant">Sin presupuestos registrados</p>
	</div>
{/if}
