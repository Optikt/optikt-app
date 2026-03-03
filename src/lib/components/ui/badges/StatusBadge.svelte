<script lang="ts">
	import { Badge } from 'flowbite-svelte';

	interface Props {
		/** Whether the item is active */
		active: boolean;
		/** Badge size */
		size?: 'xs' | 'sm' | 'default';
		/** Additional CSS classes */
		class?: string;
		/** Custom labels for active/inactive states */
		labels?: { active?: string; inactive?: string };
	}

	let { active, size = 'xs', class: className = '', labels = {} }: Props = $props();

	const activeLabel = $derived(labels.active ?? 'Activo');
	const inactiveLabel = $derived(labels.inactive ?? 'Inactivo');

	const sizeClasses: Record<string, string> = {
		xs: 'text-xs',
		sm: 'text-sm',
		default: ''
	};
</script>

<Badge color={active ? 'green' : 'gray'} class="{sizeClasses[size]} {className}">
	{active ? activeLabel : inactiveLabel}
</Badge>
