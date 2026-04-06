<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { getPurchaseOrderStatusLabel, getPurchaseOrderStatusBadgeColor } from '$lib/shared/enums';

	interface Props {
		status: string;
	}

	let { status }: Props = $props();
</script>

<AppBadge variant={getPurchaseOrderStatusBadgeColor(status)}>
	{getPurchaseOrderStatusLabel(status)}
</AppBadge>
