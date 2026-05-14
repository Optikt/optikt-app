<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import type { BadgeVariant } from '$lib/shared/badge-variants';
	import type { PurchaseOrderDueStatus } from '$lib/shared/purchaseOrderCredit';

	interface Props {
		dueStatus?: PurchaseOrderDueStatus | null;
		showNone?: boolean;
		class?: string;
	}

	let { dueStatus = null, showNone = false, class: className = '' }: Props = $props();

	const badge = $derived.by((): { label: string; variant: BadgeVariant } | null => {
		if (!dueStatus) return null;

		switch (dueStatus.kind) {
			case 'PAID':
				return { label: 'Pagada', variant: 'success' };
			case 'OVERDUE':
				return { label: 'Vencida', variant: 'error' };
			case 'DUE_TODAY':
				return { label: 'Vence hoy', variant: 'warning' };
			case 'UPCOMING':
				return {
					label: dueStatus.daysUntil != null ? `Vence en ${dueStatus.daysUntil}d` : 'Por vencer',
					variant: 'warning'
				};
			case 'EARLY_DISCOUNT_AVAILABLE':
				return {
					label:
						dueStatus.daysUntil != null ? `Pronto pago ${dueStatus.daysUntil}d` : 'Pronto pago',
					variant: 'info'
				};
			case 'NONE':
				return showNone ? { label: 'Sin vencimiento', variant: 'neutral' } : null;
			default:
				return null;
		}
	});
</script>

{#if badge}
	<AppBadge variant={badge.variant} class={className}>{badge.label}</AppBadge>
{/if}
