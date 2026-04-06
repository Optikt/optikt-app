<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { getQuoteStatusLabel, getQuoteStatusBadgeColor } from '$lib/shared/contracts/quotes';

	interface Props {
		status: string;
	}

	let { status }: Props = $props();
</script>

<AppBadge variant={getQuoteStatusBadgeColor(status)}>
	{getQuoteStatusLabel(status)}
</AppBadge>
