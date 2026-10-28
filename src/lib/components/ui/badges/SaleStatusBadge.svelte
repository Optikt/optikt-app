<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { getSaleStatusLabel, getSaleStatusBadgeColor } from '#lib/shared/enums/index.js';

	interface Props {
		status: string;
	}

	let { status }: Props = $props();
</script>

<AppBadge variant={getSaleStatusBadgeColor(status)}>
	{getSaleStatusLabel(status)}
</AppBadge>
