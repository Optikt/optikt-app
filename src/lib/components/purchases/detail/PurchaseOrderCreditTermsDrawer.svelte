<script lang="ts">
	import { toast } from 'svelte-sonner';
	import PurchaseOrderCreditDrawer from '../step1/PurchaseOrderCreditDrawer.svelte';
	import { setPurchaseOrderCreditTermsCmd } from '$lib/remote/purchaseOrders/finance.remote';
	import { getErrorMessage } from '$lib/utils';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders/types';
	import type { PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import { PurchasePaymentTerms } from '$lib/shared/enums';

	interface Props {
		open: boolean;
		purchaseOrder: PurchaseOrderWithRelations;
		onUpdated?: (payload: {
			purchaseOrder: PurchaseOrderWithRelations;
			earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let { open = $bindable(), purchaseOrder, onUpdated }: Props = $props();

	async function handleSave(terms: {
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
	}) {
		try {
			const result = await setPurchaseOrderCreditTermsCmd({
				purchaseOrderId: purchaseOrder.id,
				paymentTerms: purchaseOrder.paymentTerms as PurchasePaymentTerms,
				...terms
			});
			if (!result.success) {
				toast.error(result.error ?? 'Error actualizando las condiciones de pago');
				return;
			}
			toast.success('Condiciones de pago actualizadas');
			onUpdated?.({
				purchaseOrder: {
					...purchaseOrder,
					...result.purchaseOrder
				} as PurchaseOrderWithRelations,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error actualizando las condiciones de pago'));
		}
	}
</script>

<PurchaseOrderCreditDrawer
	bind:open
	paymentTerms={purchaseOrder.paymentTerms as PurchasePaymentTerms}
	creditDueDate={purchaseOrder.creditDueDate}
	earlyPaymentDiscountPercent={purchaseOrder.earlyPaymentDiscountPercent}
	earlyPaymentDiscountDeadline={purchaseOrder.earlyPaymentDiscountDeadline}
	onSave={handleSave}
/>
