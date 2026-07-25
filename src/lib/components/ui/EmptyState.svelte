<script lang="ts">
	import { ClipboardList } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		message: string;
		icon?: Snippet;
		class?: string;
		ariaLabel?: string;
	}

	let { message, icon, class: className = '', ariaLabel = 'Sin contenido' }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-3 py-6 text-center {className}"
	role="status"
	aria-label={ariaLabel}
>
	{#if icon}
		<div class="text-outline-variant">
			{@render icon()}
		</div>
	{:else}
		<div class="text-outline-variant">
			<ClipboardList class="h-12 w-12" />
		</div>
	{/if}
	<p class="max-w-sm text-sm text-on-surface-variant">
		{message}
	</p>
</div>
