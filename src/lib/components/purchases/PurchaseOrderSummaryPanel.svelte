<script lang="ts">
	import { Calculator } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import type { PurchaseOrderSummary } from './purchaseOrderDraft';

	interface Props {
		summary: PurchaseOrderSummary;
		bcvRate: number;
	}

	let { summary, bcvRate }: Props = $props();

	const totalInBs = $derived(summary.total * Number(bcvRate || 0));

	function formatVes(amount: number): string {
		return `Bs. ${new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount)}`;
	}
</script>

<section class="rounded-[1.75rem] bg-brand-navy p-5 text-white shadow-sm sm:p-6">
	<div class="flex items-start gap-3">
		<div
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-gold"
		>
			<Calculator class="h-5 w-5" />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Resumen total</p>
			<h2 class="mt-1 text-xl font-semibold text-white">Vista económica de la orden</h2>
		</div>
	</div>

	<div
		class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,0.9fr)] lg:items-start"
	>
		<div class="grid gap-3 sm:grid-cols-2 lg:col-span-2">
			<div class="rounded-2xl bg-white/8 p-4">
				<p class="text-sm text-white/70">Costo estimado</p>
				<p class="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
					{formatPrice(summary.total)}
				</p>
			</div>
			<div class="rounded-2xl bg-white/8 p-4">
				<p class="text-sm text-white/70">Venta estimada</p>
				<p class="mt-2 font-mono text-2xl font-semibold text-brand-gold tabular-nums">
					{formatPrice(summary.estimatedSale)}
				</p>
			</div>
		</div>

		<div class="space-y-3 rounded-2xl bg-white/6 p-4 text-sm text-white/70">
			<div class="flex items-center justify-between gap-4">
				<span>Subtotal</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{formatPrice(summary.subtotal)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>IVA estimado</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{formatPrice(summary.taxAmount)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>Líneas / Unidades</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{summary.lineCount} / {summary.totalUnits}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>Margen proyectado</span>
				<span class="font-mono text-base font-semibold text-brand-gold tabular-nums">
					{formatPrice(summary.estimatedProfit)}
				</span>
			</div>
			<div class="flex items-center justify-between gap-4">
				<span>Equivalente BCV</span>
				<span class="font-mono text-base font-semibold text-white tabular-nums">
					{bcvRate > 0 ? formatVes(totalInBs) : 'Define una tasa'}
				</span>
			</div>
		</div>
	</div>
</section>
