<script lang="ts">
	import { Isotipo } from '$lib/components';
	import ImagotipoHorizontal from '$lib/components/branding/ImagotipoHorizontal.svelte';
	import { computeSnapshotTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
	import { untrack } from 'svelte';
	import { computeDiscount, formatDate, formatPrice } from '$lib/utils';
	import {
		getPrintItemLabel,
		getPrintItemLabelClass,
		getPrintLensRxSummary
	} from '$lib/utils/printDocumentItems';

	interface RenderedRow {
		key: string;
		item: QuoteItemWithDetails;
		lineTotal: number;
	}

	let { data } = $props();

	const quote = untrack(() => data.quote);
	const items = untrack(() => data.items) as QuoteItemWithDetails[];
	const settings = untrack(() => data.settings);

	const formattedQuoteNumber = `P-${String(quote.quoteNumber).padStart(4, '0')}`;
	const businessName = settings.businessName?.trim() || 'Optikt';
	const businessLogo = settings.businessLogo?.trim() || null;
	const printLogoPrimary = '#94a3b8';
	const printLogoSecondary = '#dbe3ec';
	const watermarkPrimary = '#cbd5e1';
	const businessRif = settings.businessRif?.trim() || null;
	const businessContactPhone = settings.businessPhone?.trim() || null;
	const businessAddress = settings.businessAddress?.trim() || null;
	const customerName = quote.customer
		? `${quote.customer.firstName} ${quote.customer.lastName}`
		: 'Cliente General';
	const customerDocument = quote.customer?.idNumber ?? 'No registrado';
	const taxBreakdown = computeSnapshotTaxBreakdown(items, quote.snapshotTaxRate);
	const subtotalForTotals = taxBreakdown.taxableBase + taxBreakdown.exemptTotal;
	const ivaRate = quote.snapshotTaxRate > 0 ? quote.snapshotTaxRate : null;
	const quoteNotes = quote.notes?.trim() || null;
	const validUntilLabel = quote.validUntil ? formatReceiptDate(quote.validUntil) : null;
	const showMetaBox = Boolean(validUntilLabel || quoteNotes);

	const treatmentGroups = items.reduce<Record<string, QuoteItemWithDetails[]>>((groups, item) => {
		if (item.itemType !== SaleItemType.TREATMENT || !item.parentQuoteItemId) {
			return groups;
		}

		const existing = groups[item.parentQuoteItemId] ?? [];
		existing.push(item);
		groups[item.parentQuoteItemId] = existing;
		return groups;
	}, {});

	const renderedRows: RenderedRow[] = items
		.filter((item: QuoteItemWithDetails) => item.itemType !== SaleItemType.TREATMENT)
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

	function computeLineTotal(
		item: Pick<QuoteItemWithDetails, 'unitPrice' | 'quantity' | 'discount' | 'discountType'>
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

	function formatTaxRate(rate: number | null): string {
		if (rate === null || rate <= 0) return '';
		return new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		}).format(rate);
	}
</script>

<svelte:head>
	<title>Presupuesto {formattedQuoteNumber} - {businessName}</title>
</svelte:head>

<article
	class="quote-document relative isolate box-border w-full max-w-[660px] self-start overflow-hidden border-[0.5px] border-[#ccc] bg-white px-[10px] py-[8px] font-sans text-[11px] leading-[1.4] text-[#1a1a1a] print:max-w-[175mm]"
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
								<p class="text-[9px] leading-none text-slate-500">{businessAddress}</p>
							{/if}
							{#if businessContactPhone}
								<p class="text-[9px] leading-none text-slate-500">{businessContactPhone}</p>
							{/if}
						</div>
					</div>
				</div>

				<div class="shrink-0 text-right">
					<p class="text-[9px] font-medium tracking-[1px] text-slate-400 uppercase">
						{formatReceiptDate(quote.quoteDate)} · PRESUPUESTO
					</p>
					<p class="font-mono text-[20px] leading-none font-medium text-slate-950">
						{formattedQuoteNumber}
					</p>
				</div>
			</div>
			<div class="mt-1 flex justify-between text-slate-950">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<p class="text-[12px] font-medium">{customerName}</p>
					<p class="text-[10px] text-slate-500">Cédula/RIF: {customerDocument}</p>
					{#if validUntilLabel}
						<p class="text-[10px] text-slate-500">Válido hasta: {validUntilLabel}</p>
					{/if}
				</div>
				<div>
					<p class="mt-0.5 text-[10px] text-slate-500">
						<strong> Vendedor: </strong>
						{quote.seller?.fullName ?? 'Sin asignar'}
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
								<p class={getPrintItemLabelClass(row.item)}>{getPrintItemLabel(row.item)}</p>
								{#if row.item.itemType === SaleItemType.LENS_PAIR}
									<p class="mt-px text-[9.5px] leading-[1.25] text-slate-500">
										{getPrintLensRxSummary(row.item)}
									</p>
								{/if}
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

		{#if showMetaBox}
			<section class="receipt-grid grid grid-cols-2 gap-[10px]">
				<div class="receipt-box rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]">
					<p class="mb-[5px] text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
						Condiciones
					</p>
					{#if validUntilLabel}
						<p class="text-[10px] text-slate-700">
							Válido hasta <span class="font-medium text-slate-950">{validUntilLabel}</span>
						</p>
					{/if}
					{#if quoteNotes}
						<p class="mt-[6px] text-[10px] leading-[1.45] whitespace-pre-line text-slate-700">
							{quoteNotes}
						</p>
					{/if}
				</div>

				<div class="receipt-box rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]">
					<p class="mb-[4px] text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
						Totales
					</p>

					<div class="space-y-[2px] text-[10px] text-slate-700">
						<div class="flex items-center justify-between gap-3">
							<span>Subtotal neto</span>
							<span class="font-mono text-slate-950 tabular-nums">
								{formatPrice(subtotalForTotals)}
							</span>
						</div>

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
							<span class="font-mono tabular-nums">{formatPrice(quote.total)}</span>
						</div>
					</div>
				</div>
			</section>
		{:else}
			<section class="flex justify-end">
				<div
					class="receipt-box w-full max-w-[290px] rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]"
				>
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
							<span class="font-mono text-slate-950 tabular-nums">
								{formatPrice(subtotalForTotals)}
							</span>
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
							<span class="font-mono tabular-nums">{formatPrice(quote.total)}</span>
						</div>
					</div>
				</div>
			</section>
		{/if}

		<footer class="receipt-footer items-end justify-between gap-4 pt-2">
			<p class="text-[9.5px] text-slate-500">
				{#if validUntilLabel}
					Presupuesto válido hasta {validUntilLabel}
				{:else}
					Gracias por su preferencia
				{/if}
			</p>
		</footer>
	</div>
</article>

<style>
	.quote-document {
		break-inside: avoid-page;
		page-break-inside: avoid;
	}

	@media print {
		.quote-document,
		.receipt-grid,
		.receipt-box,
		.receipt-table,
		.receipt-footer {
			break-inside: avoid-page;
			page-break-inside: avoid;
		}

		.quote-document table,
		.quote-document thead,
		.quote-document tbody,
		.quote-document tr {
			break-inside: avoid;
			page-break-inside: avoid;
		}
	}
</style>
