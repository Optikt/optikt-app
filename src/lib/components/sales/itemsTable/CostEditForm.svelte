<script lang="ts">
	import { Check, X } from '@lucide/svelte';

	interface Props {
		editBaseCost: number;
		editMounting: number;
		editShipping: number;
		editShippingPending: boolean;
		saving: boolean;
		onSave: () => void;
		onCancel: () => void;
	}

	let {
		editBaseCost = $bindable(),
		editMounting = $bindable(),
		editShipping = $bindable(),
		editShippingPending = $bindable(),
		saving,
		onSave,
		onCancel
	}: Props = $props();
</script>

<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
	<label class="flex items-center gap-1">
		<span class="text-on-surface-variant">Cristales:</span>
		<input
			type="number"
			step="0.01"
			min="0"
			bind:value={editBaseCost}
			class="w-20 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
		/>
	</label>
	<label class="flex items-center gap-1">
		<span class="text-on-surface-variant">Montaje:</span>
		<input
			type="number"
			step="0.01"
			min="0"
			bind:value={editMounting}
			class="w-20 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
		/>
	</label>
	{#if !editShippingPending}
		<label class="flex items-center gap-1">
			<span class="text-on-surface-variant">Envío:</span>
			<input
				type="number"
				step="0.01"
				min="0"
				bind:value={editShipping}
				class="w-20 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
			/>
		</label>
	{/if}
	<label class="flex items-center gap-1.5 text-on-surface-variant">
		<input
			type="checkbox"
			bind:checked={editShippingPending}
			class="h-3.5 w-3.5 rounded border-outline-variant accent-brand-blue"
		/>
		Envío pendiente
	</label>
	<div class="flex items-center gap-1">
		<button
			type="button"
			onclick={onSave}
			disabled={saving}
			class="inline-flex items-center justify-center rounded-md bg-brand-blue p-1.5 text-white transition-colors hover:bg-brand-blue/80 disabled:opacity-50"
			title="Guardar"
		>
			<Check class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			onclick={onCancel}
			disabled={saving}
			class="inline-flex items-center justify-center rounded-md bg-surface-container-high p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-50"
			title="Cancelar"
		>
			<X class="h-3.5 w-3.5" />
		</button>
	</div>
</div>
