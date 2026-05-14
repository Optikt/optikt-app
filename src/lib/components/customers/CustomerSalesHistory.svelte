<script lang="ts">
	import { ChevronDown, CreditCard, ExternalLink } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { slide } from 'svelte/transition';
	import { SaleStatusBadge } from '$lib/components/ui/badges';
	import { formatDateOnly, formatCurrency } from '$lib/utils';
	import { getPaymentMethodLabel } from '$lib/shared/enums/salesTypes';
	import { SALE_ITEM_TYPE_LABELS } from '$lib/shared/enums/lensTypes';
	import type { HistorySale } from '$lib/server/db/queries/customerHistory';

	interface Props {
		sales: HistorySale[];
	}

	let { sales }: Props = $props();

	let expandedSaleId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedSaleId = expandedSaleId === id ? null : id;
	}

	function scrollIntoView(e: Event) {
		(e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	function getItemTypeLabel(type: string): string {
		return SALE_ITEM_TYPE_LABELS[type as keyof typeof SALE_ITEM_TYPE_LABELS] ?? type;
	}
</script>

{#if sales.length > 0}
	<div class="space-y-3">
		{#each sales as sale (sale.id)}
			{@const balance = sale.total - sale.paidAmountBcvUsd}
			{@const isExpanded = expandedSaleId === sale.id}
			<div
				class="overflow-hidden rounded-xl border border-outline-variant/30 transition-colors {isExpanded
					? 'border-brand-blue/30'
					: ''}"
			>
				<!-- Sale header row -->
				<button
					type="button"
					onclick={() => toggleExpand(sale.id)}
					class="flex w-full items-center justify-between bg-surface-container-lowest px-5 py-4 text-left transition-colors hover:bg-surface-container-low"
				>
					<div class="flex items-center gap-4">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-mono text-sm font-semibold text-on-surface">
									#{String(sale.orderNumber).padStart(4, '0')}
								</span>
								<SaleStatusBadge status={sale.status} />
							</div>
							<p class="mt-0.5 text-xs text-on-surface-variant">
								{formatDateOnly(sale.saleDate, { month: 'short' })}
								{#if sale.seller}
									<span class="text-outline">·</span>
									{sale.seller.fullName}
								{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-4">
						<div class="text-right">
							<p class="font-mono text-sm font-semibold text-on-surface">
								${formatCurrency(sale.total)}
							</p>
							{#if sale.status === 'PENDING' && balance > 0}
								<p class="font-mono text-xs text-warning">
									Debe: ${formatCurrency(balance)}
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
						{#if sale.items.length > 0}
							<div class="mb-4">
								<h4
									class="mb-2 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase"
								>
									Ítems ({sale.items.length})
								</h4>
								<div class="space-y-1.5">
									{#each sale.items as item (item.id)}
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

						<!-- Payments -->
						{#if sale.payments.length > 0}
							<div class="mb-3">
								<h4
									class="mb-2 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase"
								>
									<CreditCard class="mr-1 inline h-3.5 w-3.5" />
									Pagos ({sale.payments.length})
								</h4>
								<div class="space-y-1.5">
									{#each sale.payments as payment (payment.id)}
										<div
											class="flex items-center justify-between rounded-lg bg-surface-container-lowest px-3 py-2"
										>
											<div>
												<p class="text-sm font-medium text-on-surface">
													{getPaymentMethodLabel(payment.paymentMethod)}
												</p>
												<p class="text-xs text-on-surface-variant">
													{formatDateOnly(payment.paymentDate, { month: 'short' })}
													{#if payment.reference}
														<span class="text-outline">·</span>
														Ref: {payment.reference}
													{/if}
												</p>
											</div>
											<span class="font-mono text-sm font-medium text-on-surface">
												${formatCurrency(payment.amountBcvUsd)}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Link to full sale -->
						<!-- eslint-disable-next-line svelte/valid-compile -->
						<a
							href={resolve(`/sales/${sale.id}` as '/')}
							class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-blue transition-colors hover:text-brand-blue/80"
						>
							Ver venta completa
							<ExternalLink class="h-3 w-3" />
						</a>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-10 text-center">
		<CreditCard class="mb-2 h-8 w-8 text-outline/40" />
		<p class="text-sm text-on-surface-variant">Sin ventas registradas</p>
	</div>
{/if}
