<script lang="ts">
	interface Props {
		isSubmitting: boolean;
		submitText: string;
		onCancel: () => void;
	}

	let { isSubmitting, submitText, onCancel }: Props = $props();
</script>

<div class="flex flex-col-reverse justify-end gap-3 sm:flex-row">
	<button
		type="button"
		onclick={onCancel}
		class="rounded-lg px-5 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
	>
		Cancelar
	</button>
	<button
		type="submit"
		disabled={isSubmitting}
		class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
	>
		{#if isSubmitting}
			<span
				class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
			></span>
		{/if}
		{submitText}
	</button>
</div>
