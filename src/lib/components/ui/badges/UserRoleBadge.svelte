<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { UserRole, getUserRoleBadgeColor } from '$lib/shared/enums';

	interface Props {
		/** The user role value */
		role: UserRole | string;
		/** Additional CSS classes */
		class?: string;
	}

	let { role, class: className = '' }: Props = $props();
</script>

<AppBadge variant={getUserRoleBadgeColor(role)} class={className}>
	{role}
</AppBadge>
