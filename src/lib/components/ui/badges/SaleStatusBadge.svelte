<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { getSaleStatusLabel, getSaleStatusBadgeColor } from '$lib/shared/enums';

	interface Props {
		status: string;
	}

	let { status }: Props = $props();
</script>

<Badge color={getSaleStatusBadgeColor(status)} class="text-xs font-medium">
	{getSaleStatusLabel(status)}
</Badge>
