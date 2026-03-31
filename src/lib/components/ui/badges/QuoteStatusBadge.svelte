<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { getQuoteStatusLabel, getQuoteStatusBadgeColor } from '$lib/shared/contracts/quotes';

	interface Props {
		status: string;
	}

	let { status }: Props = $props();
</script>

<Badge color={getQuoteStatusBadgeColor(status)} class="text-xs font-medium">
	{getQuoteStatusLabel(status)}
</Badge>
