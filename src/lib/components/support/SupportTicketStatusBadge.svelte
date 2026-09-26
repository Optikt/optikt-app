<script lang="ts">
	import AppBadge from '$lib/components/ui/badges/AppBadge.svelte';
	import type { BadgeVariant } from '$lib/shared/badge-variants';
	import { TICKET_STATUS_LABELS, TicketStatus } from '$lib/shared/enums';

	let { status }: { status: TicketStatus } = $props();

	const variants: Record<TicketStatus, BadgeVariant> = {
		[TicketStatus.OPEN]: 'warning',
		[TicketStatus.IN_PROGRESS]: 'info',
		[TicketStatus.RESOLVED]: 'success',
		[TicketStatus.DISMISSED]: 'neutral'
	};
</script>

<AppBadge variant={variants[status]}>{TICKET_STATUS_LABELS[status]}</AppBadge>
