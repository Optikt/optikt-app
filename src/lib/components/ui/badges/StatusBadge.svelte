<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import type { BadgeVariant } from '$lib/shared/badge-variants';

	interface Props {
		/** Whether the item is active */
		active: boolean;
		/** Additional CSS classes */
		class?: string;
		/** Custom labels for active/inactive states */
		labels?: { active?: string; inactive?: string };
	}

	let { active, class: className = '', labels = {} }: Props = $props();

	const activeLabel = $derived(labels.active ?? 'Activo');
	const inactiveLabel = $derived(labels.inactive ?? 'Inactivo');

	const variant: BadgeVariant = $derived(active ? 'success' : 'neutral');
</script>

<AppBadge {variant} class={className}>
	{active ? activeLabel : inactiveLabel}
</AppBadge>
