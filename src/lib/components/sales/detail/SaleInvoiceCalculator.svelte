<script lang="ts">
	import { untrack } from 'svelte';
	import { Calculator, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SlideOver } from '$lib/components/ui';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import { rxRowLine } from '$lib/components/commercialDocument/itemView';
	import { getPrintItemLabel } from '$lib/utils/printDocumentItems';
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';
	import { logger } from '$lib/utils/logger';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import {
		computeInvoiceCalculation,
		invoiceSummaryText,
		type InvoiceItemInput,
		type InvoiceRateMode
	} from './facturaCalculator';

	interface Props {
		open: boolean;
		sale: SaleWithRelations;
		items: SaleItemWithDetails[];
		/** Live BCV rate (store, SSE) — «Tasa actual» and the fallback. */
		liveRate: number;
		formattedOrderNumber: string;
	}

	let { open = $bindable(), sale, items, liveRate, formattedOrderNumber }: Props = $props();

	// ── Rate selection ────────────────────────────────────────────────────
	const snapshotRate = $derived(sale.snapshotBcvRate);
	const hasSnapshot = $derived(snapshotRate !== null && snapshotRate > 0);
	const referenceRate = $derived(hasSnapshot ? (snapshotRate as number) : liveRate);

	/** Default follows the mockup: «Tasa de la venta» when the sale froze one, else «actual». */
	let mode = $state<InvoiceRateMode>(
		untrack(() => (sale.snapshotBcvRate != null && sale.snapshotBcvRate > 0 ? 'sale' : 'today'))
	);
	let custom = $state('');

	/** Keeps a stale 'sale' mode from sticking when the sale has no snapshot. */
	const effectiveMode = $derived(mode === 'sale' && !hasSnapshot ? 'today' : mode);

	const customRate = $derived(Number(custom.replace(',', '.')));
	const customOk = $derived(
		effectiveMode !== 'custom' || (Number.isFinite(customRate) && customRate > 0)
	);
	const rate = $derived(
		customOk
			? effectiveMode === 'sale'
				? referenceRate
				: effectiveMode === 'today'
					? liveRate
					: customRate
			: referenceRate
	);

	function selectMode(next: InvoiceRateMode) {
		if (next === 'sale' && !hasSnapshot) return;
		mode = next;
	}

	/**
	 * Rate-card tooltips open on HOVER only: focusing a card (e.g. after a
	 * click) would pop its tooltip up by itself — same rule as the hero menus.
	 */
	function hoverOnly(props: Record<string, unknown>): Record<string, unknown> {
		const rest = { ...props };
		delete rest.onfocus;
		delete rest.onFocus;
		delete rest.onfocusin;
		delete rest.onFocusIn;
		return rest;
	}

	// ── Lines (receipt parity: item, then its treatment rows) ─────────────
	function eyeArgs(item: SaleItemWithDetails, eye: 'od' | 'os') {
		return {
			sphere: eye === 'od' ? item.odSphere : item.osSphere,
			cylinder: eye === 'od' ? item.odCylinder : item.osCylinder,
			axis: eye === 'od' ? item.odAxis : item.osAxis,
			addition: eye === 'od' ? item.odAddition : item.osAddition
		};
	}
	function hasEyeRx(item: SaleItemWithDetails, eye: 'od' | 'os'): boolean {
		const values = [
			eye === 'od' ? item.odSphere : item.osSphere,
			eye === 'od' ? item.odCylinder : item.osCylinder,
			eye === 'od' ? item.odAxis : item.osAxis,
			eye === 'od' ? item.odAddition : item.osAddition
		];
		return values.some((value) => value != null);
	}
	function rxSummaryOf(item: SaleItemWithDetails): string | null {
		if (item.itemType !== SaleItemType.LENS_PAIR || !hasPrescriptionSnapshot(item)) return null;
		return `${rxRowLine('OD', !hasEyeRx(item, 'od'), eyeArgs(item, 'od'))} · ${rxRowLine(
			'OI',
			!hasEyeRx(item, 'os'),
			eyeArgs(item, 'os')
		)}`;
	}
	function toInput(item: SaleItemWithDetails): InvoiceItemInput {
		return {
			name: getPrintItemLabel(item),
			rxSummary: rxSummaryOf(item),
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			discount: item.discount,
			discountType: item.discountType,
			isTaxable: item.snapshotIsTaxable ?? false
		};
	}

	const invoiceItems = $derived.by(() => {
		const mains = items.filter((i) => i.itemType !== SaleItemType.TREATMENT);
		const result: InvoiceItemInput[] = [];
		for (const main of mains) {
			result.push(toInput(main));
			for (const child of items) {
				if (child.itemType === SaleItemType.TREATMENT && child.parentSaleItemId === main.id) {
					result.push(toInput(child));
				}
			}
		}
		return result;
	});

	const calculation = $derived(
		computeInvoiceCalculation({
			items: invoiceItems,
			sale: {
				discount: sale.discount ?? 0,
				discountType: sale.discountType ?? 'FIXED',
				taxRate: sale.snapshotTaxRate
			},
			rate,
			rateOk: customOk
		})
	);

	const rateModeLabel = $derived(
		effectiveMode === 'sale'
			? 'de la venta'
			: effectiveMode === 'today'
				? 'actual'
				: 'personalizada'
	);
	const fmtRate = (value: number) => formatCurrency(value);

	/** Moved from the footer to the header tooltip (design review note). */
	const CALCULATOR_NOTE =
		'Solo ayuda para facturas manuales. El precio ya incluye IVA (base = precio ÷ 1,16). Se muestran 2 decimales, pero el cálculo usa precisión completa (igual que el sistema); sumar las líneas a mano puede diferir por céntimos.';

	const saleDateLabel = $derived(formatDateOnly(sale.saleDate, { dateStyle: 'medium' }));
	const vatLabel = $derived(
		new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(sale.snapshotTaxRate)
	);

	// ── Copy helpers (value shown = value copied, comma decimal) ──────────
	function copyValue(value: string, message: string) {
		navigator.clipboard
			.writeText(value)
			.then(() => toast.success(message))
			.catch((error: unknown) => {
				logger.error('No se pudo copiar', error);
				toast.error('No se pudo copiar');
			});
	}

	function copySummary() {
		copyValue(
			invoiceSummaryText(calculation, {
				orderNumber: formattedOrderNumber,
				rateModeLabel
			}),
			'Resumen copiado'
		);
	}
</script>

{#snippet totalRow({ label, value }: { label: string; value: string })}
	<div class="flex items-center justify-between gap-3 py-[3px] text-[13px]">
		<span class="text-on-surface-variant">{label}</span>
		{@render copyCell({ props: {}, value, label })}
	</div>
{/snippet}

{#snippet copyCell({
	props,
	value,
	label
}: {
	props: Record<string, unknown>;
	value: string;
	label: string;
})}
	<button
		{...props}
		type="button"
		onclick={() => copyValue(value, `${label} copiado`)}
		class="cursor-copy border-b border-dotted border-transparent text-right font-medium text-on-surface tabular-nums transition-colors hover:border-outline hover:text-on-info-container"
	>
		{value}
	</button>
{/snippet}

{#snippet rateCard({
	props,
	key,
	label,
	sub
}: {
	props: Record<string, unknown>;
	key: InvoiceRateMode;
	label: string;
	sub: string;
})}
	<button
		{...hoverOnly(props)}
		type="button"
		aria-pressed={effectiveMode === key}
		onclick={() => selectMode(key)}
		class="cursor-pointer rounded-[10px] border px-3 py-2 text-left transition-all duration-150 {effectiveMode ===
		key
			? 'border-brand-blue bg-info-container shadow-[0_0_0_1px_var(--color-brand-blue)]'
			: 'border-outline-variant bg-white hover:border-brand-blue'}"
	>
		<b class="block text-[13px] font-semibold text-on-surface">{label}</b>
		<small class="block text-xs text-on-surface-variant">{sub}</small>
	</button>
{/snippet}

<SlideOver bind:open widthClass="w-[580px]">
	{#snippet header({ onclose: close })}
		<div class="flex items-center gap-3 border-b border-outline-variant/15 px-6 py-4">
			<span
				class="grid h-10 w-10 place-items-center rounded-xl bg-surface-container-high text-brand-navy"
			>
				<Calculator class="h-5 w-5" />
			</span>
			<div class="min-w-0 flex-1">
				<h2 class="font-heading text-lg font-semibold text-brand-navy">Calculadora de factura</h2>
				<p class="flex items-center gap-1.5 text-xs text-on-surface-variant">
					Venta {formattedOrderNumber} · Referencial, no fiscal
					<InfoTooltip text={CALCULATOR_NOTE} side="bottom" />
				</p>
			</div>
			<button
				type="button"
				onclick={close}
				class="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="pt-1">
		<p class="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">
			Tasa BCV a usar
		</p>
		<div class="grid grid-cols-3 gap-2">
			{#if hasSnapshot}
				{#snippet saleCardTip({ props: tipProps }: { props: Record<string, unknown> })}
					{@render rateCard({
						props: tipProps,
						key: 'sale',
						label: 'Tasa de la venta',
						sub: `${fmtRate(snapshotRate ?? 0)} · ${saleDateLabel}`
					})}
				{/snippet}
				<TriggerTooltip
					trigger={saleCardTip}
					text="Tasa BCV de la venta. Referencial: cada abono congela su propia tasa al registrarse."
				/>
			{:else}
				{#snippet noSaleRate({ props: tipProps }: { props: Record<string, unknown> })}
					<button
						{...tipProps}
						type="button"
						aria-disabled="true"
						onclick={() => selectMode('sale')}
						class="cursor-help rounded-[10px] border border-outline-variant bg-white px-3 py-2 text-left opacity-45"
					>
						<b class="block text-[13px] font-semibold text-on-surface">Tasa de la venta</b>
						<small class="block text-xs text-on-surface-variant">No guardada</small>
					</button>
				{/snippet}
				<TriggerTooltip trigger={noSaleRate} text="Esta venta no guardó tasa al crearse" />
			{/if}
			{#snippet todayCardTip({ props: tipProps }: { props: Record<string, unknown> })}
				{@render rateCard({
					props: tipProps,
					key: 'today',
					label: 'Tasa actual',
					sub: liveRate > 0 ? `${fmtRate(liveRate)} · en vivo` : '— · en vivo'
				})}
			{/snippet}
			<TriggerTooltip
				trigger={todayCardTip}
				text="Tasa BCV en vivo. La venta es en USD: esta conversión es solo una ayuda."
			/>
			<button
				type="button"
				aria-pressed={effectiveMode === 'custom'}
				onclick={() => selectMode('custom')}
				class="cursor-pointer rounded-[10px] border px-3 py-2 text-left transition-all duration-150 {effectiveMode ===
				'custom'
					? 'border-brand-blue bg-info-container shadow-[0_0_0_1px_var(--color-brand-blue)]'
					: 'border-outline-variant bg-white hover:border-brand-blue'}"
			>
				<b class="block text-[13px] font-semibold text-on-surface">Personalizada</b>
				<input
					bind:value={custom}
					onfocus={() => selectMode('custom')}
					inputmode="decimal"
					placeholder="0,00"
					aria-label="Tasa personalizada"
					class="mt-1 h-7 w-full rounded-md border border-outline-variant bg-white px-2 text-xs tabular-nums focus:border-brand-blue focus:outline-2 focus:-outline-offset-1 focus:outline-brand-blue"
				/>
			</button>
		</div>

		{#if !customOk}
			<div
				class="mt-3 rounded-lg bg-warning-container px-3 py-2 text-xs font-semibold text-on-warning-container"
			>
				Ingresa una tasa válida. Mientras tanto se usa la tasa de referencia.
			</div>
		{/if}

		<!-- Lines table -->
		<div
			class="mt-4 grid grid-cols-[1fr_104px_88px_108px] gap-x-2.5 border-b border-outline-variant/60 pb-1.5 text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase"
		>
			<span>Concepto</span>
			<span class="text-right">Base Bs.</span>
			<span class="text-right">IVA Bs.</span>
			<span class="text-right">Total Bs.</span>
		</div>

		{#each calculation.lines as line, index (index)}
			<div
				class="grid grid-cols-[1fr_104px_88px_108px] items-start gap-x-2.5 gap-y-0.5 border-b border-outline-variant/40 py-1.5"
			>
				<div class="min-w-0">
					<p class="text-[13px] font-semibold text-on-surface">{line.name}</p>
					{#if line.rxSummary}
						<p class="text-xs text-on-surface-variant">{line.rxSummary}</p>
					{/if}
					<p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
						<span
							class="rounded px-1.5 py-px text-[10px] font-bold tracking-[0.06em] uppercase {line.taxable
								? 'bg-info-container text-on-info-container'
								: 'bg-surface-container-high text-on-surface-variant'}"
						>
							{line.taxable ? 'Gravable' : 'Exento'}
						</span>
						{formatPrice(line.usd)}
					</p>
				</div>
				{@render copyCell({
					props: {},
					value: formatCurrency(line.baseBs),
					label: 'Base'
				})}
				{#if line.taxable}
					{@render copyCell({ props: {}, value: formatCurrency(line.ivaBs), label: 'IVA' })}
				{:else}
					<span class="text-right text-xs text-outline">—</span>
				{/if}
				{@render copyCell({ props: {}, value: formatCurrency(line.totalBs), label: 'Total' })}
			</div>
		{/each}

		{#if calculation.totals.discount > 0.01}
			<p
				class="mt-3 rounded-lg bg-warning-container px-3 py-2 text-xs font-semibold text-on-warning-container"
			>
				El descuento global se reparte proporcionalmente entre todas las líneas (gravables y
				exentas).
			</p>
		{/if}

		<!-- Totals -->
		<div class="mt-4 border-t-2 border-brand-navy pt-2">
			{#if calculation.totals.discount > 0.01}
				{@render totalRow({
					label: 'Subtotal',
					value: formatCurrency(calculation.totals.subtotalRawBs)
				})}
				{@render totalRow({
					label: '− Descuento global',
					value: formatCurrency(calculation.totals.discountBs)
				})}
			{/if}
			{@render totalRow({
				label: 'Base imponible',
				value: formatCurrency(calculation.totals.baseBs)
			})}
			{@render totalRow({
				label: 'Monto exento',
				value: formatCurrency(calculation.totals.exemptBs)
			})}
			{@render totalRow({
				label: 'Subtotal neto',
				value: formatCurrency(calculation.totals.netBs)
			})}
			{@render totalRow({
				label: `IVA (${vatLabel}%)`,
				value: formatCurrency(calculation.totals.ivaBs)
			})}

			<div
				class="mt-2 flex items-center justify-between gap-3 border-t border-outline-variant/60 pt-2"
			>
				<span class="text-[13px] font-bold text-brand-navy">
					Total Bs.
					<small class="text-xs font-medium text-on-surface-variant"
						>a tasa {fmtRate(calculation.rate)}</small
					>
				</span>
				{@render copyCell({
					props: {},
					value: formatCurrency(calculation.totals.totalBs),
					label: 'Total'
				})}
			</div>
			<div class="mt-1 flex items-center justify-between gap-3 text-[13px]">
				<span class="text-on-surface-variant">Referencia en USD</span>
				<span class="font-semibold text-on-surface tabular-nums">
					{formatPrice(calculation.totals.usdNet)}
				</span>
			</div>
		</div>
	</div>

	{#snippet footer()}
		<div class="flex items-center justify-end gap-3 border-t border-outline-variant/60 px-6 py-4">
			<button
				type="button"
				onclick={copySummary}
				class="h-9 shrink-0 cursor-pointer rounded-lg border border-outline-variant bg-white px-3.5 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
			>
				Copiar resumen
			</button>
			<button
				type="button"
				onclick={() => (open = false)}
				class="h-9 shrink-0 cursor-pointer rounded-lg bg-brand-navy px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-navy-dark"
			>
				Cerrar
			</button>
		</div>
	{/snippet}
</SlideOver>
