<script lang="ts">
	interface Props {
		value: string;
		options: { value: string; label: string }[];
		onchange?: (value: string) => void;
		disabled?: boolean;
	}

	let { value, options, onchange = undefined, disabled = false }: Props = $props();

	const activeIdx = $derived(options.findIndex((o) => o.value === value));
</script>

<div
	class="relative w-full inline-grid overflow-hidden rounded-lg border border-outline-variant/30 bg-white p-1 shadow-sm {disabled
		? 'opacity-60'
		: ''}"
	style="grid-template-columns: repeat({options.length}, 1fr)"
>
	<div
		class="absolute top-1 bottom-1 left-1 rounded-md bg-brand-navy shadow-sm transition-transform duration-200 ease-out"
		style="width: calc((100% - 0.5rem) / {options.length}); transform: translateX(calc({activeIdx} * 100%))"
	></div>
	{#each options as opt (opt.value)}
		<button
			type="button"
			onclick={() => onchange?.(opt.value)}
			{disabled}
			class="relative z-10 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 {value ===
			opt.value
				? 'text-white'
				: 'text-on-surface-variant hover:text-brand-navy'}"
		>
			{opt.label}
		</button>
	{/each}
</div>
