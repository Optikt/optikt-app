<script lang="ts">
	import { Isotipo } from '$lib/components';
	import { untrack } from 'svelte';
	import { computeSnapshotTaxBreakdown } from '$lib/components/sales/saleItemHelpers';
	import { PaymentMethod, getPaymentMethodLabel } from '$lib/shared/enums';
	import {
		getLensTypeLabel,
		LensType,
		SaleItemType,
		TreatmentCategory
	} from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { computeDiscount, formatCurrency, formatDate, formatPrice } from '$lib/utils';

	interface RenderedRow {
		key: string;
		item: SaleItemWithDetails;
		lineTotal: number;
	}

	const MATERIAL_PATTERNS = [
		{ pattern: /\bcr[\s-]?39\b/i, label: 'CR-39' },
		{ pattern: /\bpolicarbonato\b/i, label: 'Policarbonato' },
		{ pattern: /\btrivex\b/i, label: 'Trivex' },
		{ pattern: /\b(?:hi[\s-]?index|high[\s-]?index)\b/i, label: 'Hi-Index' },
		{ pattern: /\b(?:resina|organic[oa])\b/i, label: 'Resina' },
		{ pattern: /\bmineral\b/i, label: 'Mineral' }
	] as const;

	const placeholderRows = [1, 2, 3] as const;

	let { data } = $props();

	const sale = untrack(() => data.sale);
	const items = untrack(() => data.items) as SaleItemWithDetails[];
	const payments = untrack(() => data.payments) as SalePayment[];
	const settings = untrack(() => data.settings);

	const formattedOrderNumber = `#${String(sale.orderNumber).padStart(4, '0')}`;
	const businessName = settings.businessName?.trim() || 'Optikt';
	const businessLogo = settings.businessLogo?.trim() || null;
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

	function computeLineTotal(
		item: Pick<SaleItemWithDetails, 'unitPrice' | 'quantity' | 'discount' | 'discountType'>
	): number {
		const gross = item.unitPrice * item.quantity;
		return gross - computeDiscount(item.discount, item.discountType, gross);
	}

	function normalizeSearchText(value: string): string {
		return value
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase();
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

	function extractLensMaterial(rawName: string): string {
		for (const candidate of MATERIAL_PATTERNS) {
			if (candidate.pattern.test(rawName)) {
				return candidate.label;
			}
		}

		const cleaned = rawName
			.replace(/\bcristales?\b/gi, '')
			.replace(/\bmonofocal\b/gi, '')
			.replace(/\bbifocal\b/gi, '')
			.replace(/\bprogresiv[oa]s?\b/gi, '')
			.replace(/\bocupacional\b/gi, '')
			.replace(/\bfotocrom[aá]tic[oa]s?\b/gi, '')
			.replace(/\bblue\s?(?:cut|block)\b/gi, '')
			.replace(/\bantir?reflej[oa]\b/gi, '')
			.replace(/\bAR\b/g, '')
			.replace(/\s+/g, ' ')
			.trim();

		if (!cleaned) {
			return 'Personalizado';
		}

		const parts = cleaned.split(' ').filter(Boolean);
		return parts.length > 1 ? parts.slice(1).join(' ') : cleaned;
	}

	function inferLensType(rawName: string, catalogType: string | null | undefined): string | null {
		if (catalogType && catalogType !== LensType.MONOFOCAL) {
			return getLensTypeLabel(catalogType);
		}

		const normalized = normalizeSearchText(rawName);
		if (normalized.includes('progresiv')) return getLensTypeLabel(LensType.PROGRESSIVE);
		if (normalized.includes('bifocal')) return getLensTypeLabel(LensType.BIFOCAL);
		if (normalized.includes('ocupacional')) return getLensTypeLabel(LensType.OCCUPATIONAL);
		return null;
	}

	function hasInherentDescriptor(rawName: string, type: 'photochromic' | 'ar' | 'blue'): boolean {
		const normalized = normalizeSearchText(rawName);

		if (type === 'photochromic') return normalized.includes('fotocromat');
		if (type === 'blue') return /\bblue\s?(cut|block)\b/.test(normalized);
		return /\bantir?reflej[oa]\b/.test(normalized) || /\bar\b/.test(normalized);
	}

	function lensLabel(item: SaleItemWithDetails): string {
		const rawName = item.snapshotName ?? item.lensCatalogItem?.name ?? 'Personalizado';
		const parts = ['Cristal', extractLensMaterial(rawName)];
		const lensTypeLabel = inferLensType(rawName, item.lensCatalogItem?.type);

		if (lensTypeLabel) {
			parts.push(lensTypeLabel);
		}

		if (hasInherentDescriptor(rawName, 'photochromic')) {
			parts.push('Fotocromático');
		}

		if (hasInherentDescriptor(rawName, 'ar')) {
			parts.push('AR');
		}

		if (hasInherentDescriptor(rawName, 'blue')) {
			parts.push('Blueblock');
		}

		return parts.filter(Boolean).join(' ');
	}

	function treatmentLabel(item: SaleItemWithDetails): string {
		const treatmentName = item.supplierTreatment?.name ?? item.snapshotName ?? 'Tratamiento';

		switch (item.supplierTreatment?.category) {
			case TreatmentCategory.AR:
				return `Antireflejo: ${treatmentName}`;
			case TreatmentCategory.BLUECUT:
				return `Blueblock: ${treatmentName}`;
			default:
				return treatmentName;
		}
	}

	function itemLabel(item: SaleItemWithDetails): string {
		switch (item.itemType) {
			case SaleItemType.PRODUCT:
				return item.product?.name ?? item.snapshotName ?? 'Producto';
			case SaleItemType.LENS_PAIR:
				return lensLabel(item);
			case SaleItemType.TREATMENT:
				return treatmentLabel(item);
			case SaleItemType.FREE_ITEM:
				return item.freeDetails?.description ?? item.snapshotName ?? 'Ítem libre';
			default:
				return item.snapshotName ?? 'Ítem';
		}
	}

	function itemLabelClass(item: SaleItemWithDetails): string {
		return item.itemType === SaleItemType.PRODUCT || item.itemType === SaleItemType.FREE_ITEM
			? 'font-medium text-slate-950'
			: 'font-normal text-slate-950';
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
		eye: 'OD' | 'OI',
		sphere: number | null | undefined,
		cylinder: number | null | undefined,
		axis: number | null | undefined,
		addition: number | null | undefined
	): string {
		const parts: string[] = [];

		if (sphere !== null && sphere !== undefined) {
			parts.push(formatRxValue(sphere));
		}

		if (cylinder !== null && cylinder !== undefined && cylinder !== 0) {
			parts.push(formatRxValue(cylinder));
			if (axis !== null && axis !== undefined) {
				parts.push(formatAxis(axis));
			}
		}

		if (addition !== null && addition !== undefined && addition !== 0) {
			parts.push(`Add ${formatRxValue(addition)}`);
		}

		return `${eye}: ${parts.length > 0 ? parts.join(' ') : '-'}`;
	}

	function lensRxSummary(item: SaleItemWithDetails): string {
		return [
			buildEyeSummary('OD', item.odSphere, item.odCylinder, item.odAxis, item.odAddition),
			buildEyeSummary('OI', item.osSphere, item.osCylinder, item.osAxis, item.osAddition)
		].join(' · ');
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

<article
	class="sale-receipt box-border flex w-full max-w-[660px] flex-col gap-[4px] self-start border-[0.5px] border-[#ccc] bg-white px-[10px] py-[8px] font-sans text-[11px] leading-[1.4] text-[#1a1a1a] print:max-w-[175mm]"
>
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
						<Isotipo primaryColor="#0f172a" secondaryColor="#94a3b8" class="h-8 w-auto shrink-0" />
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

	<!-- <section class="border-b-[0.5px] border-[#eee] text-slate-950 flex justify-between">
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<p class="text-[12px] font-medium">{customerName}</p>
			<p class="text-[10px] text-slate-500">Cédula/RIF: {customerDocument}</p>
			{#if customerPhone}
				<p class="text-[10px] text-slate-500">Teléfono: {customerPhone}</p>
			{/if}
		</div>
		<div>
				<p class="mt-1 text-[10px] leading-none text-slate-500">
					Vendedor: {sale.seller?.fullName ?? 'Sin asignar'}
				</p>
		</div>
	</section> -->

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
							<p class={itemLabelClass(row.item)}>{itemLabel(row.item)}</p>
							{#if row.item.itemType === SaleItemType.LENS_PAIR}
								<p class="mt-px text-[9.5px] leading-[1.25] text-slate-500">
									{lensRxSummary(row.item)}
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
								{formatPaymentReceiptDate(payment.paymentDate)} - {formatPaymentBcvAmount(payment)}
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
				<div class="flex items-center justify-between gap-3">
					<span>Subtotal</span>
					<span class="font-mono text-slate-950 tabular-nums">{formatPrice(subtotalForTotals)}</span
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
						<p class="mt-1 text-[8.5px] leading-[1.3] text-slate-500">
							Monto pendiente a la fecha de generación.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<section class="receipt-box overflow-hidden rounded-[4px] border-[0.5px] border-[#e0e0e0]">
		<div class="border-b-[0.5px] border-[#eee] bg-[#fafafa] px-[9px] py-[5px]">
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
				<tr class="border-b-[0.5px] border-[#eee] bg-[#fafafa] text-left">
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

	<footer class="receipt-footer flex items-end justify-between gap-4 pt-2">
		<p class="text-[9.5px] text-slate-500">Gracias por su preferencia</p>

		<div class="-mb-2 text-center">
			<div class="mb-[3px] w-[120px] border-t-[0.5px] border-slate-400"></div>
			<p class="text-[9px] tracking-[0.04em] text-slate-400">Firma</p>
		</div>
	</footer>
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
