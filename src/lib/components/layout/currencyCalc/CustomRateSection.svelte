<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import type { SavedCustomRate } from './currencyCalcUtils';

	interface Props {
		savedRate: SavedCustomRate | null;
		isCustomStale: boolean;
		showCustomInput?: boolean;
		customRateInput?: string;
		customLabelInput?: string;
		onApply: () => void;
		onDismissStale: () => void;
		onClear: () => void;
	}

	let {
		savedRate,
		isCustomStale,
		showCustomInput = $bindable(false),
		customRateInput = $bindable(''),
		customLabelInput = $bindable(''),
		onApply,
		onDismissStale,
		onClear
	}: Props = $props();
</script>

<div class="border-t border-slate-100 px-5 pt-3 pb-2">
	<div
		role="button"
		tabindex="0"
		class="flex w-full cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800"
		onclick={() => (showCustomInput = !showCustomInput)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') showCustomInput = !showCustomInput;
		}}
	>
		<svg
			class="h-3.5 w-3.5 transition-transform {showCustomInput ? 'rotate-90' : ''}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"><path d="m9 18 6-6-6-6" /></svg
		>
		Tasa personalizada
		{#if savedRate}
			<span class="ml-auto flex items-center gap-1">
				<span class="text-xs font-normal text-slate-400">
					{savedRate.label || 'Tasa'}: {savedRate.value} Bs
				</span>
				{#if isCustomStale}
					<span
						class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600"
						title="Guardada hace más de 6 horas. Verifica que siga vigente."
					>
						<TriangleAlert size={11} />
					</span>
					<button
						type="button"
						class="flex h-5 w-5 items-center justify-center rounded text-amber-500 transition-colors hover:bg-amber-100"
						onclick={(e) => {
							e.stopPropagation();
							onDismissStale();
						}}
						title="Descartar aviso — reinicia contador de 6h"
						aria-label="Descartar aviso de tasa desactualizada"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="h-3 w-3"><path d="M20 12a8 8 0 1 1-8-8" /><path d="M12 2v4l3-3-3-3" /></svg
						>
					</button>
				{/if}
				<button
					type="button"
					class="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-slate-300 transition-colors hover:text-red-500"
					onclick={(e) => {
						e.stopPropagation();
						onClear();
					}}
					aria-label="Eliminar tasa personalizada"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="h-3 w-3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
					>
				</button>
			</span>
		{:else}
			<span class="ml-auto text-xs text-slate-400">Añadir</span>
		{/if}
	</div>
	{#if showCustomInput}
		<div class="mt-2 space-y-2">
			<div class="flex gap-2">
				<input
					type="number"
					min="0"
					step="any"
					bind:value={customRateInput}
					placeholder="Valor en Bs"
					class="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-sm text-brand-navy placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				/>
				<input
					type="text"
					bind:value={customLabelInput}
					placeholder="Etiqueta (ej: PayPal)"
					class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-brand-navy placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
				/>
				<button
					type="button"
					class="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={onApply}
					disabled={!customRateInput || parseFloat(customRateInput) <= 0}
				>
					Aplicar
				</button>
			</div>
		</div>
	{/if}
</div>
