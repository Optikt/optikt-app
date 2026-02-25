<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { ProductType, getProductTypeBadgeColor, getProductTypeLabel } from '$lib/shared/enums';

	interface Props {
		/** The product type value */
		type: ProductType | string;
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

<Badge color={getProductTypeBadgeColor(type)} class="{sizeClasses[size]} {className}">
	{getProductTypeLabel(type)}
</Badge>
