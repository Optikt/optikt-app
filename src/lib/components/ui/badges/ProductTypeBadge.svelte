<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { ProductType, getProductTypeBadgeColor, getProductTypeLabel } from '$lib/shared/enums';

	interface Props {
		/** The product type value */
		type: ProductType | string;
		/** Additional CSS classes */
		class?: string;
	}

	let { type, class: className = '' }: Props = $props();
</script>

<AppBadge variant={getProductTypeBadgeColor(type)} class={className}>
	{getProductTypeLabel(type)}
</AppBadge>
