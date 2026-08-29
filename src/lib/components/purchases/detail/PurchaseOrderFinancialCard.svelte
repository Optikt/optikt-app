<script lang="ts">
	import { CalendarClock, CirclePlus, Landmark, PiggyBank } from '@lucide/svelte';
	import { AppBadge, PurchaseOrderDueBadge } from '$lib/components/ui';
	import { getPurchaseOrderDetailContext } from '$lib/context/purchaseOrderDetail';
	import {
		CurrencyCode,
		PURCHASE_PAYMENT_METHOD_LABELS,
		PurchasePaymentMethod,
		PurchaseSourceCurrency,
		getPurchasePaymentTermsLabel
	} from '$lib/shared/enums';
	import { getCurrencySymbol } from '$lib/shared/enums';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import { formatAltAmount } from '$lib/utils/purchaseOrderDetail';

	interface Props {
		onRegisterPayment?: () => void;
		onViewPayments?: () => void;
	}

	let { onRegisterPayment = () => {}, onViewPayments = () => {} }: Props = $props();
	const ctx = getPurchaseOrderDetailContext();

	const purchaseOrder = $derived(ctx.purchaseOrder());
	const balance = $derived(ctx.balance());
	const summary = $derived(ctx.purchaseSummary());
	const hasDiscount = $derived(ctx.hasSettlementDiscount());
	const isConfirmed = $derived(ctx.isConfirmed());
	const isCancelled = $derived(ctx.isCancelled());
	const canManagePayments = $derived(ctx.canManagePayments());
	const sourceCurrency = $derived(purchaseOrder.sourceCurrency);

	const recentPayments = $derived(
		ctx
			.payments()
			.filter((payment) => !payment.voidedAt)
			.sort((left, right) => right.paymentNumber - left.paymentNumber)
			.slice(0, 3)
	);

	// ----- Costo de compra (neto como héroe + equivalencia USD-BCV) -----
	const showSourceCurrency = $derived(
		sourceCurrency !== PurchaseSourceCurrency.USD && summary.totalAlt != null
	);
	const netCostMain = $derived(
		showSourceCurrency
			? formatAltAmount(summary.netTotalAlt ?? 0, sourceCurrency)
			: formatPrice(ctx.netTotalPurchase())
	);
	const netCostEquiv = $derived(showSourceCurrency ? formatPrice(ctx.netTotalPurchase()) : null);

	// ----- Margen (sobre venta) -----
	const totalProfit = $derived(hasDiscount ? ctx.netTotalProfit() : ctx.totalProfit());
	const marginPct = $derived(
		ctx.totalSale() > 0 ? Math.round((totalProfit / ctx.totalSale()) * 100) : null
	);

	// ----- Descuento -----
	const discountRows = $derived.by(() => {
		if (showSourceCurrency) {
			return {
				subtotal: formatAltAmount(summary.subtotalAlt ?? 0, sourceCurrency),
				discount: formatAltAmount(summary.discountAmountAlt ?? 0, sourceCurrency),
				netSubtotal: formatAltAmount(summary.netSubtotalAlt ?? 0, sourceCurrency),
				netTax: formatAltAmount(summary.netTaxAmountAlt ?? 0, sourceCurrency)
			};
		}
		return {
			subtotal: formatPrice(summary.subtotal),
			discount: formatPrice(ctx.settlementDiscountAmount()),
			netSubtotal: formatPrice(summary.netSubtotal),
			netTax: formatPrice(summary.netTaxAmount)
		};
	});

	// ----- Saldo -----
	const isNativeCurrency = $derived(balance.settlementCurrency !== CurrencyCode.USD_BCV);
	const settlementSymbol = $derived(getCurrencySymbol(balance.settlementCurrency));
	const paidAmount = $derived(
		isNativeCurrency
			? `${balance.totalAppliedToDebt.toFixed(2)} ${settlementSymbol}`
			: formatPrice(balance.totalPaid)
	);
	const benefitAmount = $derived(
		isNativeCurrency
			? `${balance.settlementBenefitsApplied.toFixed(2)} ${settlementSymbol}`
			: formatPrice(balance.earlyPaymentDiscountEarned)
	);
	const pendingAmount = $derived(
		isNativeCurrency
			? `${balance.settlementBalance.toFixed(2)} ${settlementSymbol}`
			: formatPrice(balance.balance)
	);
</script>

<div class="overflow-hidden rounded-2xl bg-brand-navy text-white ring-1 ring-white/10">
	<!-- Header -->
	<div
		class="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 bg-white/5 px-3 py-2.5"
	>
		<div class="flex shrink-0 items-center gap-1.5">
			<Landmark class="h-4 w-4 text-brand-gold" />
			<h2 class="text-xs font-semibold tracking-wide whitespace-nowrap text-white uppercase">
				Resumen financiero
			</h2>
		</div>
		<AppBadge variant="neutral" class="ml-auto shrink-0">{ctx.totalUnits()} unds</AppBadge>
	</div>

	<!-- Costo de compra (hero) -->
	<div class="space-y-1 px-3 py-2.5">
		<div class="flex min-w-0 items-center gap-2">
			<p class="shrink-0 text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">
				Costo de compra
			</p>
			{#if hasDiscount}
				<AppBadge variant="info" class="shrink-0">{ctx.settlementDiscountLabel()}</AppBadge>
			{/if}
		</div>
		<div class="flex flex-wrap items-baseline gap-1.5">
			<span class="font-mono text-xl font-semibold text-white tabular-nums @sm:text-2xl"
				>{netCostMain}</span
			>
			{#if showSourceCurrency}
				<span class="text-[10px] text-white/60">{sourceCurrency}</span>
			{/if}
			{#if netCostEquiv}
				<span class="text-[10px] text-white/60 tabular-nums">≈ {netCostEquiv} USD-BCV</span>
			{/if}
		</div>

		<!-- Desglose de descuento (panel secundario, solo si aplica) -->
		{#if hasDiscount}
			<div class="mt-1.5 space-y-1 rounded-xl bg-white/8 px-2.5 py-2">
				<div class="flex justify-between text-xs">
					<span class="text-white/60">Subtotal (nota de entrega)</span>
					<span class="font-mono text-white tabular-nums">{discountRows.subtotal}</span>
				</div>
				<div class="flex justify-between text-xs">
					<span class="text-white/60">Descuento</span>
					<span class="font-mono text-brand-gold tabular-nums">− {discountRows.discount}</span>
				</div>
				<div class="h-px bg-white/15"></div>
				<div class="flex justify-between text-xs">
					<span class="font-medium text-white/60">Subtotal neto</span>
					<span class="font-mono font-medium text-white tabular-nums"
						>{discountRows.netSubtotal}</span
					>
				</div>
				<div class="flex justify-between text-xs">
					<span class="text-white/60">IVA neto</span>
					<span class="font-mono text-white tabular-nums">{discountRows.netTax}</span>
				</div>
				{#if showSourceCurrency}
					<div class="flex justify-between text-[10px]">
						<span class="text-white/60">Equiv. USD-BCV</span>
						<span class="font-mono text-white/60 tabular-nums">
							{formatPrice(summary.netSubtotal)}
						</span>
					</div>
				{/if}
			</div>
			{#if purchaseOrder.settlementDiscountNotes}
				<p class="text-[10px] whitespace-pre-wrap text-white/60">
					{purchaseOrder.settlementDiscountNotes}
				</p>
			{/if}
		{/if}
	</div>

	<!-- Margen estimado -->
	<div class="space-y-1.5 border-t border-white/10 px-3 py-2.5">
		<p class="text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">
			Margen estimado
		</p>
		<div class="flex items-end justify-between gap-3">
			<div>
				<p class="text-[10px] text-white/60">Venta estimada</p>
				<p class="font-mono text-base font-semibold text-white tabular-nums @sm:text-lg">
					{formatPrice(ctx.totalSale())}
				</p>
			</div>
			<div class="text-right">
				<p class="text-[10px] text-white/60">Ganancia</p>
				<p
					class="font-mono text-lg font-semibold tabular-nums @sm:text-xl {totalProfit >= 0
						? 'text-success'
						: 'text-error'}"
				>
					{formatPrice(totalProfit)}
				</p>
				{#if marginPct != null}
					<p class="text-[10px] text-white/60 tabular-nums">Margen {marginPct}%</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Saldo con proveedor -->
	{#if isConfirmed || isCancelled}
		<div class="space-y-2 border-t border-white/10 px-3 py-2.5">
			<div class="flex items-center justify-between gap-2">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">
					Saldo con proveedor
				</p>
				<PurchaseOrderDueBadge dueStatus={ctx.dueStatus()} class="shrink-0 whitespace-nowrap" />
			</div>

			<div class="grid grid-cols-2 gap-1.5">
				<div class="rounded-lg bg-white/8 px-2.5 py-2">
					<div class="flex items-center gap-1 text-[10px] text-white/70">
						<Landmark class="h-3 w-3 shrink-0" />
						{isNativeCurrency ? `Pagado ${settlementSymbol}` : 'Pagado'}
					</div>
					<p class="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums @sm:text-base">
						{paidAmount}
					</p>
				</div>
				<div class="rounded-lg bg-white/8 px-2.5 py-2">
					<div class="flex items-center gap-1 text-[10px] text-white/70">
						<PiggyBank class="h-3 w-3 shrink-0" />
						Dscto. obtenido
					</div>
					<p class="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums @sm:text-base">
						{benefitAmount}
					</p>
				</div>
			</div>

			<div class="rounded-lg bg-white/10 px-2.5 py-2 ring-1 ring-brand-gold/40">
				<div class="flex items-center gap-1 text-[10px] text-brand-gold">
					<CalendarClock class="h-3 w-3 shrink-0" />
					Saldo pendiente
				</div>
				<p class="mt-0.5 font-mono text-sm font-semibold text-white tabular-nums @sm:text-base">
					{pendingAmount}
				</p>
			</div>

			{#if recentPayments.length > 0}
				<div class="space-y-1.5">
					<div class="flex items-center justify-between gap-2">
						<p class="text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">Pagos</p>
						<button
							type="button"
							onclick={onViewPayments}
							class="shrink-0 text-[10px] font-semibold tracking-wide text-brand-gold uppercase hover:underline"
						>
							Ver historial
						</button>
					</div>
					<div class="space-y-1">
						{#each recentPayments as payment (payment.id)}
							<div
								class="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs"
							>
								<span class="truncate text-white/70">
									<span class="font-mono">#{payment.paymentNumber}</span>
									<span class="text-white/45">
										· {formatDateOnly(payment.paymentDate, { dateStyle: 'short' })}</span
									>
									<span class="text-white/45">
										· {PURCHASE_PAYMENT_METHOD_LABELS[
											payment.paymentMethod as PurchasePaymentMethod
										] ?? payment.paymentMethod}</span
									>
								</span>
								<span class="shrink-0 font-mono font-semibold text-white tabular-nums"
									>{formatPrice(payment.amountUsdBcv)}</span
								>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex flex-wrap items-center gap-1.5 text-[10px]">
				<AppBadge variant="neutral">
					{getPurchasePaymentTermsLabel(purchaseOrder.paymentTerms)}
				</AppBadge>
				{#if ctx.dueStatus().date}
					<span class="shrink-0 font-mono text-white/60 tabular-nums">{ctx.dueStatus().date}</span>
				{/if}
			</div>

			{#if canManagePayments}
				<button
					type="button"
					onclick={onRegisterPayment}
					class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
				>
					<CirclePlus class="h-3.5 w-3.5" />
					Registrar pago
				</button>
			{/if}
		</div>
	{/if}
</div>
