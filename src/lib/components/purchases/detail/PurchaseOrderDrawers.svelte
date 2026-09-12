<script lang="ts">
	import {
		PurchaseOrderAuditHistoryDrawer,
		PurchaseOrderPaymentsDrawer,
		PurchaseOrderPaymentsHistoryDrawer
	} from '$lib/components/purchases/detail';
	import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import type { PurchaseOrder, PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';

	interface Props {
		showPaymentsDrawer: boolean;
		showPaymentsHistoryDrawer: boolean;
		showAuditHistoryDrawer: boolean;
		purchaseOrder: PurchaseOrderWithRelations;
		payments: PurchaseOrderPaymentWithUsers[];
		earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
		balance: PurchaseOrderBalanceSummary;
		auditHistory: ChangeHistoryWithUser[];
		composerRequest: { token: string; amount: number } | null;
		onFinanceChanged: (payload: {
			payments: PurchaseOrderPaymentWithUsers[];
			earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let {
		showPaymentsDrawer = $bindable(),
		showPaymentsHistoryDrawer = $bindable(),
		showAuditHistoryDrawer = $bindable(),
		purchaseOrder,
		payments,
		earlyPaymentBenefits,
		balance,
		auditHistory,
		composerRequest,
		onFinanceChanged
	}: Props = $props();
</script>

<PurchaseOrderPaymentsDrawer
	open={showPaymentsDrawer}
	onclose={() => (showPaymentsDrawer = false)}
	purchaseOrderId={purchaseOrder.id}
	status={purchaseOrder.status}
	defaultBcvRate={purchaseOrder.bcvRate}
	{payments}
	purchaseOrder={purchaseOrder as PurchaseOrder}
	{earlyPaymentBenefits}
	pendingBalanceUsd={balance.settlementBalance}
	debtTotalUsd={balance.settlementDebtAmount}
	isFullyPaid={balance.isSettlementFullyPaid}
	settlementCurrency={balance.settlementCurrency}
	{composerRequest}
	{onFinanceChanged}
/>

<PurchaseOrderPaymentsHistoryDrawer
	open={showPaymentsHistoryDrawer}
	onclose={() => (showPaymentsHistoryDrawer = false)}
	purchaseOrderId={purchaseOrder.id}
	status={purchaseOrder.status}
	{payments}
	{earlyPaymentBenefits}
	settlementCurrency={balance.settlementCurrency}
	{onFinanceChanged}
/>

<PurchaseOrderAuditHistoryDrawer
	open={showAuditHistoryDrawer}
	onclose={() => (showAuditHistoryDrawer = false)}
	{auditHistory}
	{purchaseOrder}
/>
