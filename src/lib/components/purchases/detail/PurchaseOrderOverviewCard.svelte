<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import { PurchasePaymentTerms } from '$lib/shared/enums';
	import {
		sourceCurrencyRequiresRateToVes,
		getSourceCurrencySymbol
	} from '$lib/shared/purchaseOrderCurrencies';
	import { formatDateOnly } from '$lib/utils';
	import {
		getDocumentNumber,
		getSupplementalDeliveryNoteNumber
	} from '$lib/utils/purchaseOrderDetail';

	interface Props {
		purchaseOrder: PurchaseOrderWithRelations;
	}

	let { purchaseOrder }: Props = $props();

	const documentLabel = $derived(
		purchaseOrder.documentType === 'DELIVERY_NOTE' ? 'Nota de entrega' : 'Factura'
	);
	const documentNumber = $derived(
		getDocumentNumber(
			purchaseOrder.documentType,
			purchaseOrder.deliveryNoteNumber,
			purchaseOrder.invoiceNumber
		)
	);
	const supplementalDeliveryNoteNumber = $derived(
		getSupplementalDeliveryNoteNumber(purchaseOrder.documentType, purchaseOrder.deliveryNoteNumber)
	);
	const needsSourceRate = $derived(sourceCurrencyRequiresRateToVes(purchaseOrder.sourceCurrency));
	const srcSymbol = $derived(getSourceCurrencySymbol(purchaseOrder.sourceCurrency));
	const showExtraCols = $derived(needsSourceRate && purchaseOrder.sourceRateToVes != null);
	const paymentTermsCode = $derived(
		(purchaseOrder.paymentTerms as PurchasePaymentTerms) ?? PurchasePaymentTerms.CONTADO
	);
	const isCredit = $derived(paymentTermsCode === PurchasePaymentTerms.CREDIT);
	const hasEarlyPayment = $derived(
		Number(purchaseOrder.earlyPaymentDiscountPercent ?? 0) > 0 &&
			Boolean(purchaseOrder.earlyPaymentDiscountDeadline)
	);
</script>

<div class="rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20 overflow-hidden">
	<div
		class="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/30 bg-surface-container-high shrink-0"
	>
		<FileText class="h-5 w-5 text-brand-blue" />
		<h2 class="text-sm font-semibold uppercase tracking-wide text-brand-navy">
			Detalles de la orden
		</h2>
	</div>

	<!-- 2-col always; 3-col md+; 4-col when source rate shown -->
	<div
		class="grid grid-cols-2 gap-x-4 gap-y-3 p-4 md:p-3 {showExtraCols
			? 'md:grid-cols-3'
			: 'md:grid-cols-2'}"
	>
		<div class="space-y-1">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
				Proveedor
			</p>
			<p class="text-sm font-semibold text-brand-navy truncate">
				{purchaseOrder.supplier?.name ?? '—'}
			</p>
		</div>
		<div class="space-y-1">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
				Fecha
			</p>
			<p class="text-sm font-semibold text-brand-navy">
				{formatDateOnly(purchaseOrder.orderDate, { dateStyle: 'medium' })}
			</p>
		</div>
		<div class="space-y-1">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
				{documentLabel}
			</p>
			<p class="text-sm font-semibold text-brand-navy truncate">{documentNumber}</p>
		</div>
		<div class="space-y-1">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
				Tasa BCV
			</p>
			<p class="text-sm font-semibold text-brand-navy tabular-nums">
				{Number(purchaseOrder.bcvRate || 0).toFixed(2)} Bs/USD
			</p>
		</div>
		{#if showExtraCols}
			<div class="space-y-1">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
					Tasa {srcSymbol}
				</p>
				<p class="text-sm font-semibold text-brand-navy tabular-nums">
					{Number(purchaseOrder.sourceRateToVes || 0).toFixed(2)}
				</p>
				<p class="text-[10px] text-on-surface-variant">Normalizado a USD</p>
			</div>
		{/if}
	</div>

	<!-- Payment sub-section -->
	<div class="border-t border-outline-variant/60 px-4 py-3 md:px-3 md:py-3">
		<div class="flex items-center gap-2">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
				Pago
			</p>
			{#if isCredit}
				<AppBadge variant="info">Crédito</AppBadge>
			{:else}
				<AppBadge variant="success">Contado</AppBadge>
			{/if}
		</div>
		{#if isCredit}
			<div class="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
				<div class="space-y-0.5">
					<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
						Vencimiento
					</p>
					<p class="text-sm font-semibold text-brand-navy tabular-nums">
						{purchaseOrder.creditDueDate ? formatDateOnly(purchaseOrder.creditDueDate) : '—'}
					</p>
				</div>
				{#if hasEarlyPayment}
					<div class="space-y-0.5">
						<p
							class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
						>
							Pronto pago
						</p>
						<p class="text-xs font-medium text-on-warning-container">
							{purchaseOrder.earlyPaymentDiscountPercent}% antes del {formatDateOnly(
								purchaseOrder.earlyPaymentDiscountDeadline
							)}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if supplementalDeliveryNoteNumber || purchaseOrder.notes}
		<div class="border-t border-outline-variant/60 px-4 py-3 md:px-3 md:py-3 space-y-2">
			{#if supplementalDeliveryNoteNumber}
				<div class="space-y-0.5">
					<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
						Nota de entrega
					</p>
					<p class="text-sm font-semibold text-brand-navy">
						{supplementalDeliveryNoteNumber}
					</p>
				</div>
			{/if}
			{#if purchaseOrder.notes}
				<div class="space-y-0.5">
					<p class="text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
						Notas internas
					</p>
					<p class="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
						{purchaseOrder.notes}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
