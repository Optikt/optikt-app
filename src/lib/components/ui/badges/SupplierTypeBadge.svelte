<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { SupplierType, getSupplierTypeBadgeColor, getSupplierTypeLabel } from '$lib/shared/enums';

	interface Props {
		/** The supplier type value */
		type: SupplierType | string;
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

<Badge color={getSupplierTypeBadgeColor(type)} class="{sizeClasses[size]} {className}">
	{getSupplierTypeLabel(type)}
</Badge>
