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

<!-- Fixed bar centered to match form max width (max-w-4xl). Appears bottom-center, buttons aligned right. -->
<div class={'fixed bottom-6 left-1/2 z-40 w-full -translate-x-1/2 transform ' + className}>
	<div class="mx-auto flex w-full max-w-4xl justify-end px-4">
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
