<script lang="ts">
	import { Button, Spinner } from 'flowbite-svelte';
	import type { ClassValue, HTMLButtonAttributes } from 'svelte/elements';

	interface Props {
		primaryLabel?: string;
		cancelHref?: string;
		isSubmitting?: boolean;
		primaryType?: HTMLButtonAttributes['type'];
		className?: ClassValue;
	}

	const {
		primaryLabel = 'Guardar',
		cancelHref = '/',
		isSubmitting = false,
		primaryType = 'submit',
		className = ''
	}: Props = $props();
</script>

<!-- Fixed bar spans the available page width and keeps actions aligned to the right. -->
<div class={'fixed inset-x-0 bottom-6 z-40 w-full ' + className}>
	<div class="flex w-full justify-end px-4 sm:px-8">
		<div class="flex gap-3 rounded-lg bg-black/25 p-2 shadow-md backdrop-blur-md">
			<Button color="red" href={cancelHref} disabled={isSubmitting}>Cancelar</Button>
			<Button type={primaryType} color="blue" disabled={isSubmitting}>
				{#if isSubmitting}
					<Spinner size="4" class="mr-2" />
				{/if}
				{primaryLabel}
			</Button>
		</div>
	</div>
</div>
