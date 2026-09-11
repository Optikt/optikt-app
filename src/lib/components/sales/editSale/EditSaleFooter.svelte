<script lang="ts">
	import { Pen } from '@lucide/svelte';

	interface Props {
		reason: string;
		reasonError: string;
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
		removedCount,
		saving,
		hasChanges,
		onClose,
		onSubmit,
		onClearReasonError
	}: Props = $props();
</script>

<footer
	class="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900"
>
	<div class="space-y-3">
		<!-- Reason field -->
		<div>
			<label
				for="edit-reason"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
			>
				Motivo de la modificación <span class="text-red-500">*</span>
			</label>
			<textarea
				id="edit-reason"
				bind:value={reason}
				oninput={onClearReasonError}
				rows="2"
				placeholder="Explique por qué está modificando esta venta..."
				class="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"
			></textarea>
			{#if reasonError}<p class="mt-1 text-xs text-red-600">{reasonError}</p>{/if}
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-between gap-3">
			<div class="text-xs text-slate-500 dark:text-slate-400">
				{#if removedCount > 0}
					<span class="text-red-600 dark:text-red-400"
						>{removedCount} artículo(s) eliminado(s)</span
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
				<button
					type="button"
					onclick={onSubmit}
					disabled={saving || !hasChanges}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
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
			</div>
		</div>
	</div>
</footer>
