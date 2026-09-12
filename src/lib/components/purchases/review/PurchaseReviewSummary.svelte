<script lang="ts">
	import { TrendingUp } from '@lucide/svelte';
	import {
		PurchaseDiscountType,
		PurchaseDocumentType,
		PurchaseSourceCurrency
	} from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { formatAltAmount } from '$lib/utils/purchaseOrderDetail';
	import { calculatePurchaseOrderSummary } from '../purchaseOrderDraft';
	import type { PurchaseOrderDraftItem } from '../purchaseOrderDraft';
	import PricePair from '../PricePair.svelte';

	interface Props {
		items: PurchaseOrderDraftItem[];
		supplierName: string;
		documentType: PurchaseDocumentType;
		documentNumber: string;
		orderDate: string;
		bcvRate: number;
		sourceCurrency: string;
		discountType: PurchaseDiscountType;
		discountValue: number;
	}

	let {
		items,
		supplierName,
		documentType,
		documentNumber,
		orderDate,
		bcvRate,
		sourceCurrency,
		discountType,
		discountValue
	}: Props = $props();

	const discount = $derived({
		type: discountType,
		value: discountType === PurchaseDiscountType.NONE ? 0 : Number(discountValue || 0)
	});
	const summary = $derived(calculatePurchaseOrderSummary(items, discount, bcvRate));
	const marginPercentage = $derived(
		summary.subtotal > 0 ? (summary.estimatedProfit / summary.subtotal) * 100 : 0
	);
	const hasDiscount = $derived(discount.type !== PurchaseDiscountType.NONE && discount.value > 0);
</script>

<div
	class="flex flex-col overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20"
>
	<div class="flex flex-1 flex-col gap-3 px-4 pt-4 pb-3">
		<h2
			class="shrink-0 border-b border-outline-variant/30 pb-2 text-sm font-semibold tracking-wide text-brand-navy uppercase"
		>
			Resumen de compra
		</h2>

		<div class="shrink-0 space-y-1 text-xs">
			<div class="flex items-center gap-2">
				<span class="text-on-surface-variant">Proveedor:</span>
				<span class="truncate font-medium text-brand-navy">
					{supplierName}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-on-surface-variant">
					{documentType === PurchaseDocumentType.INVOICE ? 'Factura' : 'Nota'}:
				</span>
				<span class="truncate font-medium text-brand-navy">
					{documentNumber}
				</span>
				<span class="ml-auto text-on-surface-variant">
					BCV:
					<span class="font-medium text-brand-navy tabular-nums"
						>{Number(bcvRate || 0).toFixed(2)}</span
					>
				</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-on-surface-variant">Fecha:</span>
				<span class="font-medium text-brand-navy">{orderDate}</span>
			</div>
		</div>

		<div class="shrink-0 space-y-1.5 border-t border-outline-variant/30 pt-2 text-xs">
			<div class="flex justify-between">
				<span class="text-on-surface-variant">Subtotal</span>
				<PricePair
					amountAlt={summary.subtotalAlt ?? 0}
					amountUsd={summary.subtotal}
					{sourceCurrency}
				/>
			</div>
			{#if hasDiscount}
				<div class="flex justify-between text-success">
					<span>Descuento</span>
					<span class="font-mono tabular-nums">−{formatPrice(summary.discountAmount)}</span>
				</div>
			{/if}
			<div class="flex justify-between">
				<span class="text-on-surface-variant">IVA ({hasDiscount ? 'neto' : 'estimado'})</span>
				<span class="font-mono font-semibold text-brand-navy tabular-nums">
					{hasDiscount ? formatPrice(summary.netTaxAmount) : formatPrice(summary.taxAmount)}
				</span>
			</div>
			<div class="flex justify-between text-on-surface-variant">
				<span>Venta estimada</span>
				<span class="font-mono tabular-nums">{formatPrice(summary.estimatedSale)}</span>
			</div>
		</div>

		<div class="shrink-0 rounded-lg bg-brand-navy p-3 shadow-md">
			<p class="text-[10px] font-medium tracking-wide text-brand-blue-light/80 uppercase">
				Total neto a pagar
			</p>
			{#if sourceCurrency !== PurchaseSourceCurrency.USD}
				<p class="mt-1 font-mono text-xl font-bold text-white">
					{formatAltAmount(summary.netTotalAlt ?? 0, sourceCurrency)}
				</p>
				<p class="font-mono text-xs font-medium text-white/60 tabular-nums">
					{formatPrice(summary.netTotal)} USD
				</p>
			{:else}
				<p class="mt-1 font-mono text-xl font-bold text-white">
					{formatPrice(summary.netTotal)}
					<span class="text-sm font-medium text-white/60">USD</span>
				</p>
			{/if}
			<div class="mt-1 flex items-center gap-3 text-[10px] text-white/60">
				<span>
					{summary.lineCount}
					{summary.lineCount === 1 ? 'línea' : 'líneas'}
				</span>
				<span>·</span>
				<span>{summary.totalUnits} unds</span>
			</div>
		</div>

		<div
			class="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-success-container bg-success-container/50 p-3"
		>
			<div class="flex min-w-0 items-center gap-2">
				<TrendingUp class="h-4 w-4 shrink-0 text-on-success-container" />
				<div class="min-w-0">
					<p class="text-[10px] font-semibold tracking-wide text-on-success-container uppercase">
						Margen proyectado
					</p>
					<p class="truncate text-[9px] text-on-surface-variant">
						Venta: {formatPrice(summary.estimatedSale)}
					</p>
				</div>
			</div>
			<div class="shrink-0 text-right">
				<p class="font-mono text-lg leading-none font-bold text-on-success-container tabular-nums">
					{formatPrice(summary.estimatedProfit)}
				</p>
				<p class="text-[10px] font-medium text-on-success-container/80">
					({marginPercentage.toFixed(0)}%)
				</p>
			</div>
		</div>
	</div>
</div>
