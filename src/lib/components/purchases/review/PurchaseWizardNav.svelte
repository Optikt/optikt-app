<script lang="ts">
	import { Save } from '@lucide/svelte';

	interface Props {
		currentStep: number;
		canBack: boolean;
		canNext: boolean;
		canSave: boolean;
		saving: boolean;
		isEdit: boolean;
		onBack: () => void;
		onGoBack: () => void;
		onNext: () => void;
		onSave: () => void;
	}

	let {
		currentStep,
		canBack,
		canNext,
		canSave,
		saving,
		isEdit,
		onBack,
		onGoBack,
		onNext,
		onSave
	}: Props = $props();
</script>

<div class="flex items-center justify-between gap-3 pt-2">
	<div>
		{#if canBack}
			<button
				type="button"
				onclick={onBack}
				class="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				← Atrás
			</button>
		{:else}
			<button
				type="button"
				onclick={onGoBack}
				class="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				Cancelar
			</button>
		{/if}
	</div>
	<div class="flex items-center gap-2">
		{#if currentStep < 3}
			<button
				type="button"
				onclick={onNext}
				disabled={!canNext}
				class="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
			>
				Siguiente →
			</button>
		{:else}
			<button
				type="button"
				onclick={onSave}
				disabled={!canSave || saving}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Save class="h-4 w-4" />
				{saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear orden'}
			</button>
		{/if}
	</div>
</div>
