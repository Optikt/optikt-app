<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { SupplierType, getSupplierTypeBadgeColor, getSupplierTypeLabel } from '$lib/shared/enums';

	interface Props {
		/** The supplier type value */
		type: SupplierType | string;
		/** Additional CSS classes */
		class?: string;
	}

	let { type, class: className = '' }: Props = $props();
</script>

<AppBadge variant={getSupplierTypeBadgeColor(type)} class={className}>
	{getSupplierTypeLabel(type)}
</AppBadge>
