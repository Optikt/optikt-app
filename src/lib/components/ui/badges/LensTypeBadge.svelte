<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { LensType, getLensTypeBadgeColor, getLensTypeLabel } from '$lib/shared/enums';

	interface Props {
		/** The lens type value */
		type: LensType | string;
		/** Badge size */
		size?: 'xs' | 'sm' | 'default';
		/** Additional CSS classes */
		class?: string;
	}

	let { type, size = 'xs', class: className = '' }: Props = $props();

	const sizeClasses: Record<string, string> = {
		xs: 'text-xs',
		sm: 'text-sm',
		default: ''
	};
</script>

<Badge color={getLensTypeBadgeColor(type)} class="{sizeClasses[size]} {className}">
	{getLensTypeLabel(type)}
</Badge>
