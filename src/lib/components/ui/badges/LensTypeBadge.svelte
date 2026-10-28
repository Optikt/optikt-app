<script lang="ts">
	import AppBadge from './AppBadge.svelte';
	import { LensType, getLensTypeBadgeColor, getLensTypeLabel } from '#lib/shared/enums/index.js';

	interface Props {
		/** The lens type value */
		type: LensType | string;
		/** Additional CSS classes */
		class?: string;
	}

	let { type, class: className = '' }: Props = $props();
</script>

<AppBadge variant={getLensTypeBadgeColor(type)} class={className}>
	{getLensTypeLabel(type)}
</AppBadge>
