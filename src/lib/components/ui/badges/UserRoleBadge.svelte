<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import { UserRole, getUserRoleBadgeColor } from '$lib/shared/enums';

	interface Props {
		/** The user role value */
		role: UserRole | string;
		/** Badge size */
		size?: 'xs' | 'sm' | 'default';
		/** Additional CSS classes */
		class?: string;
	}

	let { role, size = 'xs', class: className = '' }: Props = $props();

	const sizeClasses: Record<string, string> = {
		xs: 'text-xs',
		sm: 'text-sm',
		default: ''
	};
</script>

<Badge color={getUserRoleBadgeColor(role)} class="{sizeClasses[size]} {className}">
	{role}
</Badge>
