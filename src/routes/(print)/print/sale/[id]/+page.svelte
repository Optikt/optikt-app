<script lang="ts">
	import ImagotipoHorizontal from '$lib/components/branding/ImagotipoHorizontal.svelte';
	import { untrack } from 'svelte';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import type { SalePayment } from '$lib/server/db/schema';
	import { buildReceiptViewModel } from '$lib/components/sales/print/receiptData';
	import ReceiptHeader from '$lib/components/sales/print/ReceiptHeader.svelte';
	import ReceiptItemsTable from '$lib/components/sales/print/ReceiptItemsTable.svelte';
	import ReceiptSummaryGrid from '$lib/components/sales/print/ReceiptSummaryGrid.svelte';
	import ReceiptExtraPayments from '$lib/components/sales/print/ReceiptExtraPayments.svelte';
	import ReceiptFooter from '$lib/components/sales/print/ReceiptFooter.svelte';

	let { data } = $props();

	const sale = untrack(() => data.sale);
	const items = untrack(() => data.items) as SaleItemWithDetails[];
	const payments = untrack(() => data.payments) as SalePayment[];
	const settings = untrack(() => data.settings);

	const vm = buildReceiptViewModel(sale, items, payments, settings);
</script>

<svelte:head>
	<title>Recibo de Venta {vm.formattedOrderNumber} - {vm.businessName}</title>
</svelte:head>

{#if vm.halfLetterOverflowRisk}
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
				primaryColor={vm.watermarkPrimary}
				secondaryColor={vm.watermarkPrimary}
				class="h-[150px] w-auto -rotate-45 transform opacity-[0.20]"
			/>
		</div>
	</div>

	<div class="relative z-10 flex flex-col gap-[4px]">
		<ReceiptHeader
			businessName={vm.businessName}
			businessLogo={vm.businessLogo}
			printLogoPrimary={vm.printLogoPrimary}
			printLogoSecondary={vm.printLogoSecondary}
			businessRif={vm.businessRif}
			businessAddress={vm.businessAddress}
			businessContactPhone={vm.businessContactPhone}
			formattedOrderNumber={vm.formattedOrderNumber}
			receiptDateLabel={vm.receiptDateLabel}
			customerName={vm.customerName}
			customerDocument={vm.customerDocument}
			customerPhone={vm.customerPhone}
			sellerName={vm.sellerName}
		/>

		<ReceiptItemsTable rows={vm.renderedRows} />

		<ReceiptSummaryGrid
			{payments}
			adjusted={vm.adjusted}
			hasDiscount={vm.hasDiscount}
			discountOnBase={vm.discountOnBase}
			ivaRate={vm.ivaRate}
			saleTotal={vm.saleTotal}
			remainingAmount={vm.remainingAmount}
			showRemainingAmount={vm.showRemainingAmount}
		/>

		<ReceiptExtraPayments
			show={vm.showAdditionalPayments}
			placeholderRows={vm.placeholderRows}
		/>

		<ReceiptFooter />
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
