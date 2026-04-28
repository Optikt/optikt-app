<script lang="ts">
	import { untrack } from 'svelte';
	import { computeSnapshotTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
	import { PaymentMethod, getPaymentMethodLabel } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { computeDiscount, formatCurrency, formatDate, formatPrice } from '$lib/utils';

	interface ReceiptRow {
		item: SaleItemWithDetails;
		treatments: SaleItemWithDetails[];
		lineTotal: number;
	}

	let { data } = $props();

	const sale = untrack(() => data.sale);
	const items = untrack(() => data.items) as SaleItemWithDetails[];
	const payments = untrack(() => data.payments) as SalePayment[];
	const settings = untrack(() => data.settings);
	const bcvRate = untrack(() => data.bcvRate) as number | null;

	const formattedOrderNumber = `#${String(sale.orderNumber).padStart(4, '0')}`;
	const businessName = settings.businessName?.trim() || 'Optikt';
	const businessLogo = settings.businessLogo?.trim() || '/logos/optikt-original.png';
	const customerName = sale.customer
		? `${sale.customer.firstName} ${sale.customer.lastName}`
		: 'Cliente General';
	const customerDocument = sale.customer?.idNumber ?? 'No registrado';
	const customerPhone = sale.customer?.primaryPhone ?? 'No registrado';
	const discountAmount =
		sale.discountType === 'PERCENTAGE' ? (sale.discount / 100) * sale.subtotal : sale.discount;
	const subtotalNet = sale.subtotal - discountAmount;
	const totalPaid = payments.reduce((sum, payment) => sum + payment.amountBcvUsd, 0);
	const balanceDue = Math.max(0, sale.total - totalPaid);
	const taxBreakdown = computeSnapshotTaxBreakdown(items);
	const ivaRate =
		settings.defaultTaxRate > 0
			? settings.defaultTaxRate
			: (items.find(
					(item: SaleItemWithDetails) =>
						item.snapshotIsTaxable && (item.snapshotTaxRate ?? 0) > 0
				)?.snapshotTaxRate ?? null);

	const treatmentGroups = items.reduce<Record<string, SaleItemWithDetails[]>>((groups, item) => {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentSaleItemId) {
			return groups;
		}

		const existing = groups[item.parentSaleItemId] ?? [];
		existing.push(item);
		groups[item.parentSaleItemId] = existing;
		return groups;
	}, {});

	const rows: ReceiptRow[] = items
		.filter((item: SaleItemWithDetails) => item.itemType !== SaleItemType.TREATMENT)
		.map((item) => ({
			item,
			treatments: treatmentGroups[item.id] ?? [],
			lineTotal: computeLineTotal(item)
		}));

	function computeLineTotal(
		item: Pick<SaleItemWithDetails, 'unitPrice' | 'quantity' | 'discount' | 'discountType'>
	): number {
		const gross = item.unitPrice * item.quantity;
		return gross - computeDiscount(item.discount, item.discountType, gross);
	}

	function formatBsAmount(amount: number): string {
		if (!bcvRate || bcvRate <= 0) return 'N/D';
		return `${formatCurrency(amount * bcvRate)} Bs`;
	}

	function formatOriginalPaymentAmount(payment: SalePayment): string {
		const formatted = formatCurrency(payment.amount);

		switch (payment.paymentMethod) {
			case PaymentMethod.EFECTIVO_USD:
				return `$${formatted}`;
			case PaymentMethod.BINANCE_USDT:
				return `${formatted} USDT`;
			default:
				return `${formatted} Bs`;
		}
	}

	function itemLabel(item: SaleItemWithDetails): string {
		switch (item.itemType) {
			case SaleItemType.PRODUCT:
				return item.product?.name ?? item.snapshotName ?? 'Producto';
			case SaleItemType.LENS_PAIR:
				return `Cristales ${item.lensCatalogItem?.name ?? item.snapshotName ?? 'personalizados'}`;
			case SaleItemType.FREE_ITEM:
				return item.freeDetails?.description ?? item.snapshotName ?? 'Ítem libre';
			default:
				return item.snapshotName ?? 'Ítem';
		}
	}

	function treatmentLabel(item: SaleItemWithDetails): string {
		return `Tratamiento ${item.supplierTreatment?.name ?? item.snapshotName ?? 'sin nombre'}`;
	}

	function formatRxValue(value: number | null | undefined): string {
		if (value === null || value === undefined) return '-';
		return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
	}

	function formatAxis(value: number | null | undefined): string {
		if (value === null || value === undefined) return '-';
		return `${Math.round(value)}°`;
	}

	function buildEyeSummary(
		eye: 'OD' | 'OS',
		sphere: number | null | undefined,
		cylinder: number | null | undefined,
		axis: number | null | undefined,
		addition: number | null | undefined
	): string {
		if ([sphere, cylinder, addition].every((value) => value === null || value === undefined)) {
			return `${eye} -`;
		}

		const parts = [`${eye} ${formatRxValue(sphere)}`];

		if (cylinder !== null && cylinder !== undefined && cylinder !== 0) {
			parts.push(`Cil ${formatRxValue(cylinder)}`);
			parts.push(`Eje ${formatAxis(axis)}`);
		}

		if (addition !== null && addition !== undefined && addition !== 0) {
			parts.push(`Add ${formatRxValue(addition)}`);
		}

		return parts.join(' · ');
	}

	function lensRxSummary(item: SaleItemWithDetails): string {
		return [
			buildEyeSummary('OD', item.odSphere, item.odCylinder, item.odAxis, item.odAddition),
			buildEyeSummary('OS', item.osSphere, item.osCylinder, item.osAxis, item.osAddition)
		].join('  |  ');
	}
</script>

<svelte:head>
	<title>Recibo de Venta {formattedOrderNumber} - {businessName}</title>
</svelte:head>

<article class="space-y-6 font-sans text-[13px] text-slate-900 print:text-[12px]">
	<header class="border-b border-slate-900 pb-5">
		<div class="flex items-start justify-between gap-6">
			<div class="flex items-start gap-4">
				<img src={businessLogo} alt={`Logo de ${businessName}`} class="h-14 w-auto object-contain grayscale" />
				<div class="space-y-1">
					<h1 class="font-heading text-2xl font-semibold tracking-tight text-slate-950">
						{businessName}
					</h1>
					{#if settings.businessRif}
						<p>RIF: {settings.businessRif}</p>
					{/if}
					{#if settings.businessPhone}
						<p>Teléfono: {settings.businessPhone}</p>
					{/if}
					{#if settings.businessAddress}
						<p class="max-w-[44ch] leading-relaxed">Dirección: {settings.businessAddress}</p>
					{/if}
				</div>
			</div>

			<div class="min-w-[14rem] space-y-1 border border-slate-900 px-4 py-3 text-right">
				<p class="text-[11px] font-semibold tracking-[0.18em] uppercase">Recibo de Venta</p>
				<p class="font-mono text-2xl font-bold tracking-tight">{formattedOrderNumber}</p>
				<p>Fecha: {formatDate(sale.saleDate, { dateStyle: 'medium' })}</p>
				<p>Vendedor: {sale.seller?.fullName ?? 'Sin asignar'}</p>
			</div>
		</div>
	</header>

	<section class="grid gap-4 border border-slate-300 px-4 py-4 sm:grid-cols-2 print:break-inside-avoid">
		<div>
			<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">Cliente</p>
			<p class="mt-2 text-base font-semibold text-slate-950">{customerName}</p>
			<p class="mt-1">Cédula/RIF: {customerDocument}</p>
			<p>Teléfono: {customerPhone}</p>
		</div>

		<div class="sm:text-right">
			<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">Condición</p>
			<p class="mt-2 text-base font-semibold text-slate-950">{sale.status}</p>
			{#if bcvRate}
				<p class="mt-1">Tasa BCV: {formatCurrency(bcvRate)} Bs</p>
			{/if}
		</div>
	</section>

	<section class="border border-slate-300 print:break-inside-auto">
		<table class="w-full border-collapse">
			<thead>
				<tr class="border-b border-slate-900 bg-slate-100 text-left text-[11px] font-semibold tracking-[0.14em] uppercase">
					<th class="px-4 py-3">Descripción</th>
					<th class="px-4 py-3 text-right">Cantidad</th>
					<th class="px-4 py-3 text-right">Precio Unit.</th>
					<th class="px-4 py-3 text-right">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.item.id)}
					<tr class="border-b border-slate-200 align-top">
						<td class="px-4 py-3">
							<p class="font-semibold text-slate-950">{itemLabel(row.item)}</p>
							{#if row.item.itemType === SaleItemType.LENS_PAIR}
								<p class="mt-1 text-[11px] leading-relaxed text-slate-600">
									{lensRxSummary(row.item)}
								</p>
							{/if}
							{#if row.item.discount > 0}
								<p class="mt-1 text-[11px] text-slate-500">
									Incluye descuento de {formatPrice(
										computeDiscount(
											row.item.discount,
											row.item.discountType,
											row.item.unitPrice * row.item.quantity
										)
									)}
								</p>
							{/if}
						</td>
						<td class="px-4 py-3 text-right font-mono">{row.item.quantity}</td>
						<td class="px-4 py-3 text-right font-mono">
							<div>{formatPrice(row.item.unitPrice)}</div>
							<div class="text-[11px] text-slate-500">{formatBsAmount(row.item.unitPrice)}</div>
						</td>
						<td class="px-4 py-3 text-right font-mono font-semibold">
							<div>{formatPrice(row.lineTotal)}</div>
							<div class="text-[11px] font-normal text-slate-500">{formatBsAmount(row.lineTotal)}</div>
						</td>
					</tr>

					{#each row.treatments as treatment (treatment.id)}
						<tr class="border-b border-slate-200 align-top text-[12px]">
							<td class="px-4 py-3 pl-8 text-slate-700">
								<p>{treatmentLabel(treatment)}</p>
							</td>
							<td class="px-4 py-3 text-right font-mono">{treatment.quantity}</td>
							<td class="px-4 py-3 text-right font-mono">
								<div>{formatPrice(treatment.unitPrice)}</div>
								<div class="text-[11px] text-slate-500">{formatBsAmount(treatment.unitPrice)}</div>
							</td>
							<td class="px-4 py-3 text-right font-mono">
								<div>{formatPrice(computeLineTotal(treatment))}</div>
								<div class="text-[11px] text-slate-500">{formatBsAmount(computeLineTotal(treatment))}</div>
							</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	</section>

	<section class="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
		<div class="space-y-4 border border-slate-300 px-4 py-4 print:break-inside-avoid">
			<div>
				<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">Pagos recibidos</p>
			</div>

			{#if payments.length === 0}
				<p class="text-slate-600">No hay pagos registrados para esta venta.</p>
			{:else}
				<div class="space-y-3">
					{#each payments as payment (payment.id)}
						<div class="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
							<div class="flex items-start justify-between gap-4">
								<div>
									<p class="font-semibold text-slate-950">
										{getPaymentMethodLabel(payment.paymentMethod)}
									</p>
									<p class="text-[11px] text-slate-500">
										{formatDate(payment.paymentDate, {
											dateStyle: 'medium',
											timeStyle: 'short'
										})}
									</p>
									{#if payment.reference}
										<p class="text-[11px] text-slate-500">Ref.: {payment.reference}</p>
									{/if}
								</div>
								<div class="text-right font-mono">
									<p>{formatOriginalPaymentAmount(payment)}</p>
									<p class="text-[11px] text-slate-500">Equiv. {formatPrice(payment.amountBcvUsd)}</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-3 border border-slate-900 px-4 py-4 print:break-inside-avoid">
			<div class="flex items-center justify-between gap-4">
				<span>Subtotal</span>
				<span class="font-mono font-semibold">{formatPrice(sale.subtotal)}</span>
			</div>

			{#if discountAmount > 0}
				<div class="flex items-center justify-between gap-4">
					<span>Descuento</span>
					<span class="font-mono font-semibold">-{formatPrice(discountAmount)}</span>
				</div>

				<div class="flex items-center justify-between gap-4">
					<span>Subtotal neto</span>
					<span class="font-mono font-semibold">{formatPrice(subtotalNet)}</span>
				</div>
			{/if}

			{#if taxBreakdown.taxAmount > 0}
				<div class="flex items-center justify-between gap-4">
					<span>IVA{#if ivaRate} ({formatCurrency(ivaRate)}%){/if}</span>
					<span class="font-mono font-semibold">{formatPrice(taxBreakdown.taxAmount)}</span>
				</div>
			{/if}

			<div class="border-t border-slate-300 pt-3">
				<div class="flex items-center justify-between gap-4 text-base font-bold text-slate-950">
					<span>Total USD</span>
					<span class="font-mono">{formatPrice(sale.total)}</span>
				</div>
				<div class="mt-2 flex items-center justify-between gap-4 text-base font-bold text-slate-950">
					<span>Total Bs</span>
					<span class="font-mono">{formatBsAmount(sale.total) ?? 'N/D'}</span>
				</div>
			</div>

			<div class="border-t border-slate-300 pt-3">
				<div class="flex items-center justify-between gap-4">
					<span>Total pagado</span>
					<span class="font-mono font-semibold">{formatPrice(totalPaid)}</span>
				</div>
				<div class="mt-2 flex items-center justify-between gap-4 text-base font-bold {balanceDue > 0.01 ? 'text-slate-950' : 'text-slate-700'}">
					<span>Saldo pendiente</span>
					<span class="font-mono">{formatPrice(balanceDue)}</span>
				</div>
			</div>
		</div>
	</section>

	<footer class="space-y-6 border-t border-slate-900 pt-6 print:break-inside-avoid">
		<div class="space-y-1 text-center">
			<p class="text-base font-semibold text-slate-950">Gracias por su preferencia</p>
			{#if settings.businessWebsite}
				<p class="text-[11px] text-slate-500">{settings.businessWebsite}</p>
			{/if}
		</div>

		<div class="pt-8">
			<div class="mx-auto w-full max-w-[18rem] border-t border-slate-900 pt-2 text-center text-[11px] uppercase tracking-[0.16em]">
				Firma del cliente
			</div>
		</div>
	</footer>
</article>