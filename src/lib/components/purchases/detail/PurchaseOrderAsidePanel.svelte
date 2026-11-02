<script lang="ts">
	import { getPurchaseOrderDetailContext } from '$lib/context/purchaseOrderDetail';
	import PurchaseOrderAuditTimeline from './PurchaseOrderAuditTimeline.svelte';
	import PurchaseOrderFinancialCard from './PurchaseOrderFinancialCard.svelte';
	import PurchaseOrderReviewProgressCard from './PurchaseOrderReviewProgressCard.svelte';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';

	interface Props {
		onRegisterPayment: () => void;
		onViewPayments: () => void;
		onViewAudit: () => void;
		onBenefitRegistered?: (payload: {
			earlyPaymentBenefits: import('$lib/server/db/schema').PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let { onRegisterPayment, onViewPayments, onViewAudit, onBenefitRegistered }: Props = $props();
	const ctx = getPurchaseOrderDetailContext();
</script>

{#if ctx.isDraft() && ctx.isReadyForReview()}
	<PurchaseOrderReviewProgressCard items={ctx.items()} zeroPriceCount={ctx.zeroPriceCount()} />
{/if}

<PurchaseOrderFinancialCard {onRegisterPayment} {onViewPayments} {onBenefitRegistered} />

<PurchaseOrderAuditTimeline
	auditHistory={ctx.auditHistory()}
	purchaseOrder={ctx.purchaseOrder()}
	{onViewAudit}
/>
