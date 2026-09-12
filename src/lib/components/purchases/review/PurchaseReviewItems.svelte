<script lang="ts">
	import { PackageCheck } from '@lucide/svelte';
	import PricePair from '../PricePair.svelte';
	import { calculateDraftItemTotalAlt } from '../purchaseOrderDraft';
	import { getDraftItemTitle, getItemSku } from './purchaseReview';
	import type { PurchaseOrderDraftItem } from '../purchaseOrderDraft';

	interface Props {
		items: PurchaseOrderDraftItem[];
		sourceCurrency: string;
	}

	let { items, sourceCurrency }: Props = $props();
</script>

<div
	class="flex flex-col overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20"
>
	<div
		class="flex shrink-0 items-center gap-2 border-b border-outline-variant/30 bg-surface-container-high px-4 py-3"
	>
		<PackageCheck class="h-5 w-5 text-brand-blue" />
		<h2 class="text-sm font-semibold tracking-wide text-brand-navy uppercase">
			Artículos incluidos
		</h2>
		<span
			class="ml-auto rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue"
		>
			{items.length}
			{items.length === 1 ? 'ítem' : 'ítems'}
		</span>
	</div>

	<div
		class="grid shrink-0 grid-cols-[3rem_1fr_5rem_5rem] gap-3 border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-[10px] font-medium tracking-wide text-on-surface-variant uppercase"
	>
		<span>Cant.</span>
		<span>Artículo</span>
		<span class="text-right">C. Unit</span>
		<span class="text-right">Total</span>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto p-2">
		<div class="flex flex-col">
			{#each items as item (item.id)}
				<div
					class="grid grid-cols-[3rem_1fr_5rem_5rem] items-center gap-3 rounded-md border-b border-outline-variant/10 px-2 py-2.5 transition-colors duration-150 last:border-none hover:bg-surface-container-high"
				>
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-high font-mono text-sm font-bold text-brand-navy"
					>
						{item.quantity}x
					</span>
					<div class="flex min-w-0 flex-col">
						<span
							class="truncate text-sm font-medium text-brand-navy"
							title={getDraftItemTitle(item)}
						>
							{getDraftItemTitle(item)}
						</span>
						<span class="flex items-center gap-1.5 truncate font-mono text-[10px]">
							<span class="text-on-surface-variant">{getItemSku(item)}</span>
							<span
								class="inline-block rounded px-1 py-0.5 text-[9px] font-bold {item.appliesIva
									? 'bg-brand-blue/10 text-brand-blue'
									: 'bg-surface-container-high text-on-surface-variant'}"
							>
								{item.appliesIva ? `IVA ${item.ivaRate}%` : 'Exento'}
							</span>
						</span>
					</div>
					<div class="text-right">
						<PricePair
							amountAlt={Number(item.unitPurchasePriceAlt ?? 0)}
							amountUsd={Number(item.unitPurchasePrice || 0)}
							{sourceCurrency}
						/>
					</div>
					<div class="text-right">
						<PricePair
							amountAlt={calculateDraftItemTotalAlt(item)}
							amountUsd={Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0)}
							{sourceCurrency}
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
