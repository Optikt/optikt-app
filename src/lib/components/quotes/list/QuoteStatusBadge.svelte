<script lang="ts">
	import AppBadge from '$lib/components/ui/badges/AppBadge.svelte';
	import { getQuoteStatusBadgeColor, getQuoteStatusLabel } from '$lib/shared/contracts/quotes';

	interface Props {
		status: string;
		/** Override de texto. */
		label?: string;
		class?: string;
	}

	let { status, label, class: className = '' }: Props = $props();
</script>

<AppBadge variant={getQuoteStatusBadgeColor(status)} class={className}>
	{label ?? getQuoteStatusLabel(status)}
</AppBadge>
