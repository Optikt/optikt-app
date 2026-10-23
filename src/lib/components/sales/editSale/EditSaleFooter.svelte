<script lang="ts">
	import { CircleAlert, Pen } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		reason: string;
		reasonError: string;
		submitError?: string;
		removedCount: number;
		saving: boolean;
		hasChanges: boolean;
		onClose: () => void;
		onSubmit: () => void;
		onClearReasonError: () => void;
	}

	let {
		reason = $bindable(),
		reasonError,
		submitError = '',
		removedCount,
		saving,
		hasChanges,
		onClose,
		onSubmit,
		onClearReasonError
	}: Props = $props();

	const reasonMissing = $derived(!reason.trim());
	const canSubmit = $derived(hasChanges && !reasonMissing);
	const showReasonHint = $derived(hasChanges && reasonMissing);
</script>

<footer
	class="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900"
>
	<div class="space-y-3">
		<!-- Reason field -->
		<div>
			<div class="mb-1.5 flex items-center justify-between gap-2">
				<label
					for="edit-reason"
					class="block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
				>
					Motivo de la modificación <span class="text-red-500">*</span>
				</label>
				<span
					class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
				>
					Obligatorio
				</span>
			</div>
			<textarea
				id="edit-reason"
				bind:value={reason}
				oninput={onClearReasonError}
				rows="2"
				placeholder="Explique por qué está modificando esta venta..."
				class="w-full resize-none rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light {showReasonHint
					? 'border-amber-300 dark:border-amber-700'
					: 'border-slate-300 dark:border-slate-600'}"></textarea>
			<p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
				Se registra en la auditoría de la venta.
			</p>
			{#if reasonError}<p class="mt-1 text-xs text-red-600">{reasonError}</p>{/if}
			{#if showReasonHint}
				<p class="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-600">
					<CircleAlert class="h-3.5 w-3.5" /> Falta el motivo para guardar.
				</p>
			{/if}
		</div>

		{#if submitError}
			<div
				class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300"
				role="alert"
			>
				{submitError}
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex items-center justify-between gap-3">
			<div class="text-xs text-slate-500 dark:text-slate-400">
				{#if removedCount > 0}
					<span class="text-red-600 dark:text-red-400">{removedCount} artículo(s) eliminado(s)</span
					>
				{/if}
			</div>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={onClose}
					disabled={saving}
					class="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
				>
					Cancelar
				</button>

				{#snippet saveTrigger({ props }: { props: Record<string, unknown> })}
					<button
						{...props}
						type="button"
						onclick={() => {
							if (saving || !canSubmit) return;
							onSubmit();
						}}
						aria-disabled={saving || !canSubmit}
						class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-navy-dark aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
					>
						{#if saving}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
							></span>
							Guardando...
						{:else}
							<Pen class="h-4 w-4" /> Guardar cambios
						{/if}
					</button>
				{/snippet}

				{#if showReasonHint}
					<TriggerTooltip
						title="Falta completar:"
						items={['Motivo de la modificación']}
						trigger={saveTrigger}
					/>
				{:else}
					{@render saveTrigger({ props: {} })}
				{/if}
			</div>
		</div>
	</div>
</footer>
