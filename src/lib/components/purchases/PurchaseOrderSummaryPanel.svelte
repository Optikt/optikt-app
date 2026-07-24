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
	import {
		sourceCurrencyRequiresRateToVes,
		getSourceCurrencySymbol
	} from '$lib/shared/purchaseOrderCurrencies';

	interface Props {
		summary: PurchaseOrderSummary;
		bcvRate: number;
		discount?: PurchaseOrderDiscountInput;
		sourceCurrency?: string;
		sourceRateToVes?: number;
		compact?: boolean;
	}

	let {
		summary,
		bcvRate,
		discount = NO_PURCHASE_ORDER_DISCOUNT,
		sourceCurrency = PurchaseSourceCurrency.USD,
		sourceRateToVes: _sv = 0,
		compact = false
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

	const sectionClass = $derived(
		compact
			? 'rounded-xl bg-brand-navy p-3 text-white shadow-sm'
			: 'rounded-[1.75rem] bg-brand-navy p-5 text-white shadow-sm sm:p-6'
	);
	const iconContainerClass = $derived(
		compact
			? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-gold'
			: 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-gold'
	);
	const iconClass = $derived(compact ? 'h-4 w-4' : 'h-5 w-5');
	const gridClass = $derived(
		compact
			? 'mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(15rem,0.9fr)] lg:items-start'
			: 'mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,0.9fr)] lg:items-start'
	);
	const innerCardClass = $derived(
		compact ? 'rounded-2xl bg-white/8 p-2.5' : 'rounded-2xl bg-white/8 p-4'
	);
	const amountClass = $derived(
		compact
			? 'mt-1 font-mono text-xl font-semibold text-white tabular-nums'
			: 'mt-2 font-mono text-2xl font-semibold text-white tabular-nums'
	);
	const amountClassGold = $derived(
		compact
			? 'mt-1 font-mono text-xl font-semibold text-brand-gold tabular-nums'
			: 'mt-2 font-mono text-2xl font-semibold text-brand-gold tabular-nums'
	);
	const sideColumnClass = $derived(
		compact
			? 'space-y-1.5 rounded-2xl bg-white/6 p-2.5 text-xs text-white/70'
			: 'space-y-3 rounded-2xl bg-white/6 p-4 text-sm text-white/70'
	);
	const sideAmountClass = $derived(
		compact
			? 'font-mono text-sm font-semibold text-white tabular-nums'
			: 'font-mono text-base font-semibold text-white tabular-nums'
	);
	const sideAmountClassGold = $derived(
		compact
			? 'font-mono text-sm font-semibold text-brand-gold tabular-nums'
			: 'font-mono text-base font-semibold text-brand-gold tabular-nums'
	);
	const sideAmountPlainClass = $derived(
		compact
			? 'font-mono text-sm font-semibold tabular-nums'
			: 'font-mono text-base font-semibold tabular-nums'
	);
</script>

<section class={sectionClass}>
	<div class="flex items-start gap-3">
		<div class={iconContainerClass}>
			<Calculator class={iconClass} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Resumen total</p>
			{#if compact}
				<p class="mt-0.5 text-sm font-semibold text-white">Vista económica</p>
			{:else}
				<h2 class="mt-1 text-xl font-semibold text-white">Vista económica de la orden</h2>
			{/if}
		</div>
	</div>

	<div class={gridClass}>
		<div class="grid gap-3 sm:grid-cols-2 lg:col-span-2">
			<div class={innerCardClass}>
				<p class="text-sm text-white/70">
					{hasDiscount ? 'Costo bruto (nota de entrega)' : 'Costo estimado'}
				</p>
				{#if needsSourceRate && (summary.totalAlt != null || summary.netTotalAlt != null)}
					<p class={amountClass}>
						{getSourceCurrencySymbol(sourceCurrency)}
						{(hasDiscount
							? (summary.netTotalAlt ?? 0)
							: (summary.totalAlt ?? summary.total)
						).toFixed(2)}
					</p>
					<p class="mt-1 text-xs text-white/60">
						Costo inventario: {formatPrice(summary.total)}
						{#if hasDiscount}
							<span class="ml-1">/ {formatPrice(summary.netTotal)} neto</span>
						{/if}
					</p>
				{:else}
					<p class={amountClass}>
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
			<div class={innerCardClass}>
				<p class="text-sm text-white/70">Venta estimada</p>
				<p class={amountClassGold}>
					{formatPrice(summary.estimatedSale)}
				</p>
			</div>
		</div>

		<div class={sideColumnClass}>
			{#if needsSourceRate}
				<div class="flex items-center justify-between gap-4">
					<span>Subtotal</span>
					<span class={sideAmountClass}>
						{getSourceCurrencySymbol(sourceCurrency)}
						{(summary.subtotalAlt ?? 0).toFixed(2)}
					</span>
				</div>
				{#if hasDiscount}
					<div class="flex items-center justify-between gap-4 text-brand-gold">
						<span>Descuento ({discountLabel})</span>
						<span class={sideAmountPlainClass}>
							− {getSourceCurrencySymbol(sourceCurrency)}
							{(summary.discountAmountAlt ?? 0).toFixed(2)}
						</span>
					</div>
				{/if}
				<div class="flex items-center justify-between gap-4">
					<span>Subtotal neto</span>
					<span class={sideAmountClass}>
						{getSourceCurrencySymbol(sourceCurrency)}
						{(summary.netSubtotalAlt ?? summary.subtotalAlt ?? 0).toFixed(2)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>{hasDiscount ? 'IVA neto' : 'IVA estimado'}</span>
					<span class={sideAmountClass}>
						{getSourceCurrencySymbol(sourceCurrency)}
						{(hasDiscount ? (summary.netTaxAmountAlt ?? 0) : (summary.taxAmountAlt ?? 0)).toFixed(
							2
						)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Líneas / Unidades</span>
					<span class={sideAmountClass}>
						{summary.lineCount} / {summary.totalUnits}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Margen proyectado</span>
					<span class={sideAmountClassGold}>
						{formatPrice(hasDiscount ? summary.netEstimatedProfit : summary.estimatedProfit)}
					</span>
				</div>
				<hr class="border-white/10" />
				<div class="flex items-center justify-between gap-4">
					<span>Total {getSourceCurrencySymbol(sourceCurrency)}</span>
					<span class={sideAmountClass}>
						{getSourceCurrencySymbol(sourceCurrency)}
						{(hasDiscount ? (summary.netTotalAlt ?? 0) : (summary.totalAlt ?? 0)).toFixed(2)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Equiv. USD</span>
					<span class={sideAmountClass}>
						{formatPrice(hasDiscount ? summary.netTotal : summary.total)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Equivalente BCV</span>
					<span class={sideAmountClass}>
						{bcvRate > 0 ? formatVes(hasDiscount ? netTotalInBs : totalInBs) : 'Define una tasa'}
					</span>
				</div>
				<hr class="border-white/10" />
				<div class="flex items-center justify-between gap-4">
					<span>Venta estimada</span>
					<span class={sideAmountClassGold}>
						{formatPrice(summary.estimatedSale)}
					</span>
				</div>
			{:else}
				<div class="flex items-center justify-between gap-4">
					<span>Subtotal</span>
					<span class={sideAmountClass}>
						{formatPrice(summary.subtotal)}
					</span>
				</div>
				{#if hasDiscount}
					<div class="flex items-center justify-between gap-4 text-brand-gold">
						<span>Descuento ({discountLabel})</span>
						<span class={sideAmountPlainClass}>
							− {formatPrice(summary.discountAmount)}
						</span>
					</div>
					<div class="flex items-center justify-between gap-4">
						<span>Subtotal neto</span>
						<span class={sideAmountClass}>
							{formatPrice(summary.netSubtotal)}
						</span>
					</div>
				{/if}
				<div class="flex items-center justify-between gap-4">
					<span>{hasDiscount ? 'IVA neto' : 'IVA estimado'}</span>
					<span class={sideAmountClass}>
						{formatPrice(hasDiscount ? summary.netTaxAmount : summary.taxAmount)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Líneas / Unidades</span>
					<span class={sideAmountClass}>
						{summary.lineCount} / {summary.totalUnits}
					</span>
				</div>
				<div class="flex items-center justify-between gap-4">
					<span>Margen proyectado</span>
					<span class={sideAmountClassGold}>
						{formatPrice(hasDiscount ? summary.netEstimatedProfit : summary.estimatedProfit)}
					</span>
				</div>
				{#if canShowBsEquivalent}
					<div class="flex items-center justify-between gap-4">
						<span>Equivalente BCV</span>
						<span class={sideAmountClass}>
							{bcvRate > 0 ? formatVes(hasDiscount ? netTotalInBs : totalInBs) : 'Define una tasa'}
						</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</section>
