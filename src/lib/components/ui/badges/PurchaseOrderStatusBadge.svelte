<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { getPurchaseOrderStatusLabel, getPurchaseOrderStatusBadgeColor } from '$lib/shared/enums';

	interface Props {
		status: string;
	}

	let { status }: Props = $props();
</script>

<Badge color={getPurchaseOrderStatusBadgeColor(status)} class="text-xs font-medium">
	{getPurchaseOrderStatusLabel(status)}
</Badge>
