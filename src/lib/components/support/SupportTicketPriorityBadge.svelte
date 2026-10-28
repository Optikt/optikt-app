<script lang="ts">
	import AppBadge from '#lib/components/ui/badges/AppBadge.svelte';
	import type { BadgeVariant } from '#lib/shared/badge-variants.js';
	import { TICKET_PRIORITY_LABELS, TicketPriority } from '#lib/shared/enums/index.js';

	let { priority }: { priority: TicketPriority } = $props();

	const variants: Record<TicketPriority, BadgeVariant> = {
		[TicketPriority.LOW]: 'neutral',
		[TicketPriority.MEDIUM]: 'info',
		[TicketPriority.HIGH]: 'warning',
		[TicketPriority.URGENT]: 'error'
	};
</script>

<AppBadge variant={variants[priority]}>{TICKET_PRIORITY_LABELS[priority]}</AppBadge>
