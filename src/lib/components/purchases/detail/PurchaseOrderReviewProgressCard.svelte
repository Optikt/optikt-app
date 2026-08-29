<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
	import { getPurchaseOrderReviewStatus } from '$lib/components/purchases/purchaseOrderDraft';

	interface Props {
		items: PurchaseOrderItemWithProduct[];
		zeroPriceCount: number;
	}

	let { items, zeroPriceCount }: Props = $props();

	const reviewStatus = $derived(getPurchaseOrderReviewStatus(items));
</script>

<div class="overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20">
	<div class="px-4 pt-4 pb-3">
		<h2
			class="border-b border-outline-variant/30 pb-2 text-sm font-semibold tracking-wide text-brand-navy uppercase"
		>
			Progreso de revisión
		</h2>
		<div class="mt-3 space-y-2">
			<div class="h-2 overflow-hidden rounded-full bg-surface-container-high">
				<div
					class="h-full rounded-full transition-all duration-300 {reviewStatus.allReviewed
						? 'bg-success'
						: 'bg-brand-blue'}"
					style="width: {items.length > 0 ? (reviewStatus.reviewedCount / items.length) * 100 : 0}%"
				></div>
			</div>
			<div class="flex justify-between text-xs">
				<span class="text-on-surface-variant"
					>{reviewStatus.reviewedCount} / {items.length} artículos revisados</span
				>
				<span class="font-semibold {reviewStatus.allReviewed ? 'text-success' : 'text-brand-blue'}"
					>{items.length > 0
						? Math.round((reviewStatus.reviewedCount / items.length) * 100)
						: 0}%</span
				>
			</div>
			{#if zeroPriceCount > 0}
				<div class="flex items-center gap-1.5 text-xs text-warning">
					<AlertTriangle class="h-3.5 w-3.5 shrink-0" />
					<span>{zeroPriceCount} con advertencia</span>
				</div>
			{/if}
			{#if !reviewStatus.allReviewed}
				<p class="text-[10px] text-on-surface-variant">
					Confirma cada línea antes de proceder con la orden.
				</p>
			{:else}
				<p class="text-[10px] font-medium text-success">
					Todos los artículos han sido revisados. Puedes confirmar la orden.
				</p>
			{/if}
		</div>
	</div>
</div>
