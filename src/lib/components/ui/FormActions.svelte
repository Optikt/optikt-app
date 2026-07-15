<script lang="ts">
	import { Button } from '$lib/components/ui/button';
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

<div class={'fixed inset-x-0 bottom-6 z-40 w-full ' + className}>
	<div class="flex w-full justify-end px-4 sm:px-8">
		<div class="flex gap-3 rounded-lg bg-black/25 p-2 shadow-md backdrop-blur-md">
			<Button variant="destructive" href={cancelHref} disabled={isSubmitting}>Cancelar</Button>
			<Button type={primaryType} disabled={isSubmitting}>
				{#if isSubmitting}
					<svg class="mr-2 inline-block h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/>
					</svg>
				{/if}
				{primaryLabel}
			</Button>
		</div>
	</div>
</div>
