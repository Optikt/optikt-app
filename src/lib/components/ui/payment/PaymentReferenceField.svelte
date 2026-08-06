<script lang="ts">
	import { ChevronDown, FileText } from '@lucide/svelte';

	interface Props {
		reference: string;
		notes: string;
		label?: string;
		placeholder?: string;
		required?: boolean;
		helper?: string;
		onReference: (value: string) => void;
		onNotes: (value: string) => void;
		class?: string;
	}

	let {
		reference,
		notes,
		label = 'Referencia',
		placeholder = 'Banco, recibo o referencia',
		required = false,
		helper,
		onReference,
		onNotes,
		class: className = ''
	}: Props = $props();

	let showNotes = $state(false);
</script>

<div class="space-y-2 {className}">
	<label class="block space-y-1.5">
		<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
			{label}
			{#if !required}
				<span class="font-normal tracking-normal text-outline normal-case">(opcional)</span>
			{/if}
		</span>
		<input
			type="text"
			value={reference}
			oninput={(event) => onReference((event.currentTarget as HTMLInputElement).value)}
			{placeholder}
			class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none"
		/>
		{#if helper}
			<p class="text-[10px] text-on-surface-variant">{helper}</p>
		{/if}
	</label>

	<button
		type="button"
		onclick={() => (showNotes = !showNotes)}
		class="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase transition-colors hover:text-on-surface"
		aria-expanded={showNotes}
	>
		<FileText class="h-3 w-3" />
		{showNotes ? 'Ocultar nota' : 'Agregar nota'}
		<ChevronDown
			class="h-3 w-3 transition-transform duration-200 {showNotes ? 'rotate-180' : ''}"
		/>
	</button>
	{#if showNotes}
		<input
			type="text"
			value={notes}
			oninput={(event) => onNotes((event.currentTarget as HTMLInputElement).value)}
			placeholder="Observaciones"
			class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none"
		/>
	{/if}
</div>
