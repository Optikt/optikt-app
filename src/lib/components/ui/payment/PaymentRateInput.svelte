<script lang="ts">
	interface Props {
		label: string;
		value: string;
		oninput: (value: string) => void;
		placeholder?: string;
		prefix?: string;
		editable?: boolean;
		onToggleEditable?: () => void;
		class?: string;
	}

	let {
		label,
		value,
		oninput,
		placeholder = '',
		prefix,
		editable = true,
		onToggleEditable,
		class: className = ''
	}: Props = $props();
</script>

<label class="block space-y-1.5 {className}">
	<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">{label}</span>
	<div class="relative">
		{#if prefix}
			<span class="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-xs text-outline"
				>{prefix}</span
			>
		{/if}
		<input
			type="number"
			{value}
			oninput={(event) => oninput((event.currentTarget as HTMLInputElement).value)}
			step="0.01"
			min="0"
			readonly={!editable}
			{placeholder}
			class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 font-mono text-sm text-on-surface placeholder:text-outline focus:border-brand-blue focus:outline-none {prefix
				? 'pl-8'
				: ''} {editable ? '' : 'opacity-60'} {className}"
		/>
		{#if onToggleEditable}
			<button
				type="button"
				onclick={onToggleEditable}
				class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface-variant"
				aria-label={editable ? 'Bloquear tasa' : 'Editar tasa'}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3"
					><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg
				>
			</button>
		{/if}
	</div>
</label>
