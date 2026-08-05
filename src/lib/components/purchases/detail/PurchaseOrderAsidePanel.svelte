<script lang="ts">
	import { getPurchaseOrderDetailContext } from '$lib/context/purchaseOrderDetail';
	import PurchaseOrderAuditTimeline from './PurchaseOrderAuditTimeline.svelte';
	import PurchaseOrderFinancialCard from './PurchaseOrderFinancialCard.svelte';
	import PurchaseOrderReviewProgressCard from './PurchaseOrderReviewProgressCard.svelte';

	interface Props {
		onRegisterPayment: () => void;
		onViewPayments: () => void;
		onViewAudit: () => void;
	}

	let { onRegisterPayment, onViewPayments, onViewAudit }: Props = $props();
	const ctx = getPurchaseOrderDetailContext();
</script>

{#if ctx.isDraft() && ctx.isReadyForReview()}
	<PurchaseOrderReviewProgressCard items={ctx.items()} zeroPriceCount={ctx.zeroPriceCount()} />
{/if}

<PurchaseOrderFinancialCard {onRegisterPayment} {onViewPayments} />

<PurchaseOrderAuditTimeline
	auditHistory={ctx.auditHistory()}
	purchaseOrder={ctx.purchaseOrder()}
	{onViewAudit}
/>
