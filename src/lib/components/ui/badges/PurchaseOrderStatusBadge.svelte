<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import {
		getPurchaseOrderUiStateLabel,
		getPurchaseOrderUiStateBadgeColor
	} from '$lib/shared/enums';

	interface Props {
		status: string;
		isReadyForReview?: boolean | null;
	}

	let { status, isReadyForReview = false }: Props = $props();

	const stateSource = $derived({ status, isReadyForReview });
</script>

<AppBadge variant={getPurchaseOrderUiStateBadgeColor(stateSource)}>
	{getPurchaseOrderUiStateLabel(stateSource)}
</AppBadge>
