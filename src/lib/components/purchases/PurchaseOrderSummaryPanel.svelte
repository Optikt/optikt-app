<script lang="ts">
	import { Calculator } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import {
		PurchaseDiscountType,
		getPurchaseDiscountTypeLabel,
		PurchaseSourceCurrency
	} from '$lib/shared/enums';
	import {
		NO_PURCHASE_ORDER_DISCOUNT,
		type PurchaseOrderDiscountInput,
		type PurchaseOrderSummary
	} from './purchaseOrderDraft';
	import { sourceCurrencyRequiresRateToVes, getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';

	interface Props {
		summary: PurchaseOrderSummary;
		bcvRate: number;
		discount?: PurchaseOrderDiscountInput;
		sourceCurrency?: string;
		sourceRateToVes?: number;
	}

	let {
		summary,
		bcvRate,
		discount = NO_PURCHASE_ORDER_DISCOUNT,
		sourceCurrency = PurchaseSourceCurrency.USD,
		sourceRateToVes: _sv = 0
	}: Props = $props();

	const needsSourceRate = $derived(sourceCurrencyRequiresRateToVes(sourceCurrency));
	const hasDiscount = $derived(discount.type !== PurchaseDiscountType.NONE && discount.value > 0);

	// For EUR/USDT/PayPal: totalAlt holds the source-currency total; Bs equivalent = USD total × BCV rate
	// For VES: totalAlt holds the Bs total directly
	const totalInBs = $derived(
		needsSourceRate
			? (hasDiscount ? summary.netTotal : summary.total) * Number(bcvRate || 0)
			: (summary.totalAlt ?? summary.total * Number(bcvRate || 0))
	);
	const netTotalInBs = $derived(
		needsSourceRate
			? summary.netTotal * Number(bcvRate || 0)
			: (summary.netTotalAlt ?? summary.netTotal * Number(bcvRate || 0))
	);
	const canShowBsEquivalent = $derived(
		summary.totalAlt !== undefined || summary.netTotalAlt !== undefined || bcvRate > 0
	);

	function formatVes(amount: number): string {
		return `Bs. ${new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount)}`;
	}

	const discountLabel = $derived(
		discount.type === PurchaseDiscountType.PERCENT
			? `${discount.value}%`
			: discount.type === PurchaseDiscountType.AMOUNT
				? needsSourceRate
					? `${getSourceCurrencySymbol(sourceCurrency)} ${discount.value.toFixed(2)}`
					: formatPrice(discount.value)
				: getPurchaseDiscountTypeLabel(discount.type)
	);
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
				<p class="text-sm text-white/70">
					{hasDiscount ? 'Costo bruto (nota de entrega)' : 'Costo estimado'}
				</p>
				{#if needsSourceRate && (summary.totalAlt != null || summary.netTotalAlt != null)}
					<p class="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
						{getSourceCurrencySymbol(sourceCurrency)} {(hasDiscount ? (summary.netTotalAlt ?? 0) : (summary.totalAlt ?? summary.total)).toFixed(2)}
					</p>
					<p class="mt-1 text-xs text-white/60">
						Costo inventario: {formatPrice(summary.total)}
						{#if hasDiscount}
							<span class="ml-1">/ {formatPrice(summary.netTotal)} neto</span>
						{/if}
					</p>
				{:else}
					<p class="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
						{formatPrice(summary.total)}
					</p>
					{#if hasDiscount}
						<p class="mt-2 text-xs text-white/60">
							Costo neto (factura):
							<span class="font-mono font-semibold text-brand-gold tabular-nums">
								{formatPrice(summary.netTotal)}
							</span>
						</p>
					{/if}
				{/if}
			</div>
			<div class="rounded-2xl bg-white/8 p-4">
				<p class="text-sm text-white/70">Venta estimada</p>
				<p class="mt-2 font-mono text-2xl font-semibold text-brand-gold tabular-nums">
					{formatPrice(summary.estimatedSale)}
				</p>
			</div>
		</div>

		<div class="space-y-3 rounded-2xl bg-white/6 p-4 text-sm text-white/70">
			{#if needsSourceRate}
				<div class="flex items-center justify-between gap-4">
					<span>Subtotal</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{getSourceCurrencySymbol(sourceCurrency)} {(summary.subtotalAlt ?? 0).toFixed(2)}
					</span>
				</div>
				{#if hasDiscount}
					<div class="flex items-center justify-between gap-4 text-brand-gold">
						<span>Descuento ({discountLabel})</span>
						<span class="font-mono text-base font-semibold tabular-nums">
							− {getSourceCurrencySymbol(sourceCurrency)} {(summary.discountAmountAlt ?? 0).toFixed(2)}
						</span>
					</div>
				{/if}
				<div class="flex items-center justify-between gap-4">
					<span>Subtotal neto</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{getSourceCurrencySymbol(sourceCurrency)} {(summary.netSubtotalAlt ?? summary.subtotalAlt ?? 0).toFixed(2)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>{hasDiscount ? 'IVA neto' : 'IVA estimado'}</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{getSourceCurrencySymbol(sourceCurrency)} {(hasDiscount ? (summary.netTaxAmountAlt ?? 0) : (summary.taxAmountAlt ?? 0)).toFixed(2)}
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
						{formatPrice(hasDiscount ? summary.netEstimatedProfit : summary.estimatedProfit)}
					</span>
				</div>
				<hr class="border-white/10" />
				<div class="flex items-center justify-between gap-4">
					<span>Total {getSourceCurrencySymbol(sourceCurrency)}</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{getSourceCurrencySymbol(sourceCurrency)} {(hasDiscount ? (summary.netTotalAlt ?? 0) : (summary.totalAlt ?? 0)).toFixed(2)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Equiv. USD</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{formatPrice(hasDiscount ? summary.netTotal : summary.total)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Equivalente BCV</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{bcvRate > 0 ? formatVes(hasDiscount ? netTotalInBs : totalInBs) : 'Define una tasa'}
					</span>
				</div>
				<hr class="border-white/10" />
				<div class="flex items-center justify-between gap-4">
					<span>Venta estimada</span>
					<span class="font-mono text-base font-semibold text-brand-gold tabular-nums">
						{formatPrice(summary.estimatedSale)}
					</span>
				</div>
			{:else}
				<div class="flex items-center justify-between gap-4">
					<span>Subtotal</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{formatPrice(summary.subtotal)}
					</span>
				</div>
				{#if hasDiscount}
					<div class="flex items-center justify-between gap-4 text-brand-gold">
						<span>Descuento ({discountLabel})</span>
						<span class="font-mono text-base font-semibold tabular-nums">
							− {formatPrice(summary.discountAmount)}
						</span>
					</div>
					<div class="flex items-center justify-between gap-4">
						<span>Subtotal neto</span>
						<span class="font-mono text-base font-semibold text-white tabular-nums">
							{formatPrice(summary.netSubtotal)}
						</span>
					</div>
				{/if}
				<div class="flex items-center justify-between gap-4">
					<span>{hasDiscount ? 'IVA neto' : 'IVA estimado'}</span>
					<span class="font-mono text-base font-semibold text-white tabular-nums">
						{formatPrice(hasDiscount ? summary.netTaxAmount : summary.taxAmount)}
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
						{formatPrice(hasDiscount ? summary.netEstimatedProfit : summary.estimatedProfit)}
					</span>
				</div>
				{#if canShowBsEquivalent}
					<div class="flex items-center justify-between gap-4">
						<span>Equivalente BCV</span>
						<span class="font-mono text-base font-semibold text-white tabular-nums">
							{bcvRate > 0 ? formatVes(hasDiscount ? netTotalInBs : totalInBs) : 'Define una tasa'}
						</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</section>
