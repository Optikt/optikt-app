<script lang="ts">
	import { Isotipo } from '$lib/components';
	import ImagotipoHorizontal from '$lib/components/branding/ImagotipoHorizontal.svelte';
	import { computeSnapshotTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
	import { PaymentMethod, SaleStatus, getPaymentMethodLabel } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { computeDiscount, formatCurrency, formatDate, formatPrice } from '$lib/utils';
	import {
		getPrintItemLabel,
		getPrintItemLabelClass,
		getPrintLensRxSummary,
		hasHalfLetterReceiptOverflowRisk
	} from '$lib/utils/printDocumentItems';

	interface RenderedRow {
		key: string;
		item: SaleItemWithDetails;
		lineTotal: number;
	}

	const defaultPlaceholderRows = [1, 2, 3] as const;
	const compactPlaceholderRows = [1, 2] as const;

	let { data } = $props();

	const sale = untrack(() => data.sale);
	const items = untrack(() => data.items) as SaleItemWithDetails[];
	const payments = untrack(() => data.payments) as SalePayment[];
	const settings = untrack(() => data.settings);

	const formattedOrderNumber = `#${String(sale.orderNumber).padStart(4, '0')}`;
	const businessName = settings.businessName?.trim() || 'Optikt';
	const businessLogo = settings.businessLogo?.trim() || null;
	const printLogoPrimary = '#94a3b8';
	const printLogoSecondary = '#dbe3ec';
	const watermarkPrimary = '#cbd5e1';
	const businessRif = settings.businessRif?.trim() || null;
	const businessContactPhone = settings.businessPhone?.trim() || null;
	const businessAddress = settings.businessAddress?.trim() || null;
	const customerName = sale.customer
		? `${sale.customer.firstName} ${sale.customer.lastName}`
		: 'Cliente General';
	const customerDocument = sale.customer?.idNumber ?? 'No registrado';
	const customerPhone = sale.customer?.primaryPhone?.trim() || null;
	const taxBreakdown = computeSnapshotTaxBreakdown(items, sale.snapshotTaxRate);
	const subtotalForTotals = taxBreakdown.taxableBase + taxBreakdown.exemptTotal;
	const ivaRate = sale.snapshotTaxRate > 0 ? sale.snapshotTaxRate : null;
	const remainingAmount = Math.max(0, sale.total - sale.paidAmountBcvUsd);
	const showRemainingAmount = payments.length > 0 && remainingAmount > 0.01;
	const showAdditionalPayments = sale.status !== SaleStatus.COMPLETED;

	const treatmentGroups = items.reduce<Record<string, SaleItemWithDetails[]>>((groups, item) => {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentSaleItemId) {
			return groups;
		}

		const existing = groups[item.parentSaleItemId] ?? [];
		existing.push(item);
		groups[item.parentSaleItemId] = existing;
		return groups;
	}, {});

	const renderedRows: RenderedRow[] = items
		.filter((item: SaleItemWithDetails) => item.itemType !== SaleItemType.TREATMENT)
		.flatMap((item) => [
			{
				key: item.id,
				item,
				lineTotal: computeLineTotal(item)
			},
			...(treatmentGroups[item.id] ?? []).map((treatment) => ({
				key: treatment.id,
				item: treatment,
				lineTotal: computeLineTotal(treatment)
			}))
		]);
	const halfLetterOverflowRisk = hasHalfLetterReceiptOverflowRisk({
		itemLineCount: renderedRows.length,
		paymentCount: payments.length
	});
	const placeholderRows = halfLetterOverflowRisk ? compactPlaceholderRows : defaultPlaceholderRows;

	function computeLineTotal(
		item: Pick<SaleItemWithDetails, 'unitPrice' | 'quantity' | 'discount' | 'discountType'>
	): number {
		const gross = item.unitPrice * item.quantity;
		return gross - computeDiscount(item.discount, item.discountType, gross);
	}

	function formatReceiptDate(date: Date | string | null): string {
		const formatted = formatDate(date, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

		return formatted.replace(/(\b[a-záéíóúñ]{3})(?=\s\d{4}\b)/iu, (match) =>
			match.endsWith('.') ? match : `${match}.`
		);
	}

	function formatOriginalPaymentAmount(payment: SalePayment): string {
		const formatted = formatCurrency(payment.amount);

		switch (payment.paymentMethod) {
			case PaymentMethod.EFECTIVO_USD:
				return formatPrice(payment.amount);
			case PaymentMethod.BINANCE_USDT:
				return `${formatted} USDT`;
			default:
				return `${formatted} Bs`;
		}
	}

	function formatPaymentReceiptDate(date: Date | string | null): string {
		return formatDate(date, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function formatPaymentBcvAmount(payment: SalePayment): string {
		return `${formatPrice(payment.amountBcvUsd)} (BCV)`;
	}

	function formatTaxRate(rate: number | null): string {
		if (rate === null || rate <= 0) return '';
		return new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		}).format(rate);
	}
</script>

<svelte:head>
	<title>Recibo de Venta {formattedOrderNumber} - {businessName}</title>
</svelte:head>

{#if halfLetterOverflowRisk}
	<div
		class="mx-auto mb-3 max-w-[660px] rounded-lg border border-warning/30 bg-warning-container px-3 py-2 text-xs font-medium text-on-warning-container print:hidden"
	>
		Este recibo tiene muchos ítems o pagos y puede superar media carta.
	</div>
{/if}

<article
	class="sale-receipt relative isolate mx-auto box-border w-full max-w-[660px] self-start overflow-hidden border-[0.5px] border-[#ccc] bg-white px-[10px] py-[8px] font-sans text-[11px] leading-[1.4] text-[#1a1a1a] print:w-[175mm] print:max-w-[175mm]"
>
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
		<div class="absolute inset-x-0 top-[50%] flex -translate-y-1/2 justify-center">
			<ImagotipoHorizontal
				primaryColor={watermarkPrimary}
				secondaryColor={watermarkPrimary}
				class="h-[150px] w-auto -rotate-45 transform opacity-[0.20]"
			/>
		</div>
	</div>

	<div class="relative z-10 flex flex-col gap-[4px]">
		<header class="border-b-[0.5px] border-[#ddd]">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<div class="flex items-start gap-2">
						{#if businessLogo}
							<img
								src={businessLogo}
								alt={`Logo de ${businessName}`}
								class="h-8 w-auto shrink-0 object-contain grayscale"
							/>
						{:else}
							<Isotipo
								primaryColor={printLogoPrimary}
								secondaryColor={printLogoSecondary}
								class="h-8 w-auto shrink-0"
							/>
						{/if}
						<div class="min-w-0 space-y-0.5">
							<div class="flex items-end gap-x-1">
								<p class="text-[15px] leading-none font-medium text-slate-950">{businessName}</p>
								{#if businessRif}
									<p class="text-[9px] leading-none text-slate-500">RIF: {businessRif}</p>
								{/if}
							</div>
							{#if businessAddress}
								<p class="text-[9px] leading-none text-slate-500">
									{businessAddress}
								</p>
							{/if}
							{#if businessContactPhone}
								<p class="text-[9px] leading-none text-slate-500">
									{businessContactPhone}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<div class="shrink-0 text-right">
					<p class="text-[9px] font-medium tracking-[1px] text-slate-400 uppercase">
						{formatReceiptDate(sale.saleDate)} · RECIBO DE VENTA
					</p>
					<p class="font-mono text-[20px] leading-none font-medium text-slate-950">
						{formattedOrderNumber}
					</p>
				</div>
			</div>
			<div class="mt-1 flex justify-between text-slate-950">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<p class="text-[12px] font-medium">{customerName}</p>
					<p class="text-[10px] text-slate-500">Cédula/RIF: {customerDocument}</p>
					{#if customerPhone}
						<p class="text-[10px] text-slate-500">Teléfono: {customerPhone}</p>
					{/if}
				</div>
				<div>
					<p class="mt-0.5 text-[10px] text-slate-500">
						<strong> Vendedor: </strong>
						{sale.seller?.fullName ?? 'Sin asignar'}
					</p>
				</div>
			</div>
		</header>

		<section class="receipt-table">
			<table class="w-full border-collapse">
				<colgroup>
					<col class="w-[60%]" />
					<col class="w-[8%]" />
					<col class="w-[16%]" />
					<col class="w-[16%]" />
				</colgroup>
				<thead>
					<tr class="border-b-[0.5px] border-[#ddd] text-left">
						<th
							class="py-[3px] pr-1 text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
						>
							Descripción
						</th>
						<th
							class="py-[3px] pl-1 text-center text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
						>
							Cant.
						</th>
						<th
							class="py-[3px] pl-1 text-right text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
						>
							P. Unit.
						</th>
						<th
							class="py-[3px] pl-1 text-right text-[9px] font-normal tracking-[0.08em] text-slate-400 uppercase"
						>
							Total
						</th>
					</tr>
				</thead>
				<tbody>
					{#each renderedRows as row (row.key)}
						<tr class="border-b-[0.5px] border-[#eee] align-top last:border-b-0">
							<td class="py-[5px] pr-1">
								<p class={getPrintItemLabelClass(row.item)}>
									{getPrintItemLabel(row.item)}
									{#if row.item.itemType === SaleItemType.LENS_PAIR}
										<span class="ml-1 text-[9.5px] font-normal text-slate-500">
											{getPrintLensRxSummary(row.item)}
										</span>
									{/if}
								</p>
							</td>
							<td class="py-[5px] pl-1 text-center font-mono text-[10.5px] tabular-nums">
								{row.item.quantity}
							</td>
							<td class="py-[5px] pl-1 text-right font-mono text-[10.5px] tabular-nums">
								{formatPrice(row.item.unitPrice)}
							</td>
							<td class="py-[5px] pl-1 text-right font-mono text-[10.5px] tabular-nums">
								{formatPrice(row.lineTotal)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<section class="receipt-grid grid grid-cols-2 gap-[10px]">
			<div class="receipt-box rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]">
				<p class="mb-[5px] text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
					Pagos registrados
				</p>

				{#if payments.length === 0}
					<p class="mt-3 text-[10px] text-slate-400 italic">
						Sin pagos registrados al momento de generar este recibo
					</p>
				{:else}
					<div class="space-y-[3px]">
						{#each payments as payment (payment.id)}
							<div class="border-b-[0.5px] border-[#f0f0f0] last:border-b-0">
								<div class="flex items-start justify-between gap-3">
									<p class="min-w-0 text-[10px] font-medium text-slate-950">
										{getPaymentMethodLabel(payment.paymentMethod)}:
									</p>
									<p
										class="shrink-0 text-right font-mono text-[10px] font-medium text-slate-950 tabular-nums"
									>
										{formatOriginalPaymentAmount(payment)}
									</p>
								</div>
								<p class="text-[9.5px] text-slate-500">
									{formatPaymentReceiptDate(payment.paymentDate)}
									{#if payment.reference}
										| Ref: {payment.reference.slice(-6)}
									{/if}
									| {formatPaymentBcvAmount(payment)}
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="receipt-box rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]">
				<p class="mb-[4px] text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
					Totales
				</p>

				<div class="space-y-[2px] text-[10px] text-slate-700">
					{#if taxBreakdown.taxableBase > 0}
						<div class="flex items-center justify-between gap-3">
							<span>Base imponible</span>
							<span class="font-mono text-slate-950 tabular-nums">
								{formatPrice(taxBreakdown.taxableBase)}
							</span>
						</div>
					{/if}

					{#if taxBreakdown.exemptTotal > 0}
						<div class="flex items-center justify-between gap-3">
							<span>Exento</span>
							<span class="font-mono text-slate-950 tabular-nums">
								{formatPrice(taxBreakdown.exemptTotal)}
							</span>
						</div>
					{/if}

					<div class="flex items-center justify-between gap-3">
						<span>Subtotal neto</span>
						<span class="font-mono text-slate-950 tabular-nums"
							>{formatPrice(subtotalForTotals)}</span
						>
					</div>

					{#if taxBreakdown.taxAmount > 0}
						<div class="flex items-center justify-between gap-3">
							<span
								>IVA{#if ivaRate !== null}
									({formatTaxRate(ivaRate)}%){/if}</span
							>
							<span class="font-mono text-slate-950 tabular-nums">
								{formatPrice(taxBreakdown.taxAmount)}
							</span>
						</div>
					{/if}

					<div
						class="mt-1 flex items-center justify-between gap-3 border-t-[0.5px] border-[#ddd] pt-[5px] text-[12px] font-medium text-slate-950"
					>
						<span>Total</span>
						<span class="font-mono tabular-nums">{formatPrice(sale.total)}</span>
					</div>

					{#if showRemainingAmount}
						<div class="mt-[5px] border-t-[0.5px] border-[#eee] pt-[5px]">
							<div
								class="flex items-center justify-between gap-3 text-[10px] font-medium text-slate-950"
							>
								<span>Monto pendiente</span>
								<span class="font-mono tabular-nums">{formatPrice(remainingAmount)}</span>
							</div>
							<p class="text-[8.5px] leading-[1.3] text-slate-500">
								Monto pendiente a la fecha de generación.
							</p>
						</div>
					{/if}
				</div>
			</div>
		</section>

		{#if showAdditionalPayments}
			<section class="receipt-box overflow-hidden rounded-[4px] border-[0.5px] border-[#e0e0e0]">
				<div class="border-b-[0.5px] border-[#eee] px-[9px] py-[5px]">
					<p class="text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
						ABONOS ADICIONALES
					</p>
				</div>

				<table class="w-full border-collapse text-[10px]">
					<colgroup>
						<col class="w-[19%]" />
						<col class="w-[33%]" />
						<col class="w-[16%]" />
						<col class="w-[16%]" />
						<col class="w-[16%]" />
					</colgroup>
					<thead>
						<tr class="border-b-[0.5px] border-[#eee] text-left">
							<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Fecha </th>
							<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400">
								Método / Referencia
							</th>
							<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Monto Bs </th>
							<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Monto $ </th>
							<th class="px-2 py-[3px] text-[8.5px] font-normal text-slate-400"> Pendiente $ </th>
						</tr>
					</thead>
					<tbody>
						{#each placeholderRows as placeholderRow (placeholderRow)}
							<tr class="border-b-[0.5px] border-[#eee] last:border-b-0">
								<td class="px-2 pt-[8px] pb-[4px] text-[9.5px] text-[#c6c6c6]">__ / __ / ____</td>
								<td class="px-2 pt-[8px] pb-[4px] text-[9px] text-[#ccc]">
									________________________________
								</td>
								<td class="px-2 pt-[8px] pb-[4px] font-mono text-[9px] text-[#ccc] tabular-nums">
									_____________
								</td>
								<td class="px-2 pt-[8px] pb-[4px] font-mono text-[9px] text-[#ccc] tabular-nums">
									_____________
								</td>
								<td class="px-2 pt-[8px] pb-[4px] font-mono text-[9px] text-[#ccc] tabular-nums">
									_____________
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		<footer class="receipt-footer flex items-end justify-between gap-4 pt-2">
			<p class="text-[9.5px] text-slate-500">Gracias por su preferencia</p>

			<div class="-mb-2 text-center">
				<div class="mb-[3px] w-[120px] border-t-[0.5px] border-slate-400"></div>
				<p class="text-[9px] tracking-[0.04em] text-slate-400">Firma</p>
			</div>
		</footer>
	</div>
</article>

<style>
	.sale-receipt {
		break-inside: avoid-page;
		page-break-inside: avoid;
	}

	@media print {
		.sale-receipt,
		.receipt-grid,
		.receipt-box,
		.receipt-table,
		.receipt-footer {
			break-inside: avoid-page;
			page-break-inside: avoid;
		}

		.sale-receipt table,
		.sale-receipt thead,
		.sale-receipt tbody,
		.sale-receipt tr {
			break-inside: avoid;
			page-break-inside: avoid;
		}
	}
</style>
