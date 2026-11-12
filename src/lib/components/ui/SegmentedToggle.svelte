<script lang="ts">
	import type { Component } from 'svelte';

	interface Option {
		value: string;
		label: string;
		/** Icono lucide opcional, a la izquierda del label */
		icon?: Component<{ class?: string }>;
	}

	interface Props {
		value: string;
		options: Option[];
		onchange?: (value: string) => void;
		disabled?: boolean;
		/** 'default': pill navy activo (kit). 'light': activo en blanco con sombra. */
		variant?: 'default' | 'light';
		class?: string;
	}

	let {
		value,
		options,
		onchange = undefined,
		disabled = false,
		variant = 'default',
		class: className = 'w-full'
	}: Props = $props();

	const activeIdx = $derived(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);
	const isLight = $derived(variant === 'light');

	let rootEl = $state<HTMLDivElement>();

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;
		const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!delta) return;
		event.preventDefault();
		const next = (activeIdx + delta + options.length) % options.length;
		onchange?.(options[next].value);
		rootEl?.querySelectorAll('button')[next]?.focus();
	}
</script>

<div
	bind:this={rootEl}
	role="tablist"
	class="relative inline-grid overflow-hidden rounded-lg p-1 {isLight
		? 'border border-outline-variant/30 bg-surface-container-high'
		: 'border border-outline-variant/30 bg-white shadow-sm'} {disabled
		? 'opacity-60'
		: ''} {className}"
	style="grid-template-columns: repeat({options.length}, 1fr)"
>
	<div
		class="absolute top-1 bottom-1 left-1 rounded-md shadow-sm transition-transform duration-200 ease-out {isLight
			? 'bg-white'
			: 'bg-brand-navy'}"
		style="width: calc((100% - 0.5rem) / {options.length}); transform: translateX(calc({activeIdx} * 100%))"
	></div>
	{#each options as opt (opt.value)}
		{@const Icon = opt.icon}
		<button
			type="button"
			role="tab"
			aria-selected={value === opt.value}
			tabindex={value === opt.value ? 0 : -1}
			onclick={() => onchange?.(opt.value)}
			onkeydown={handleKeydown}
			{disabled}
			class="relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 {value ===
			opt.value
				? isLight
					? 'text-brand-navy'
					: 'text-white'
				: 'text-on-surface-variant hover:text-brand-navy'}"
		>
			{#if Icon}
				<Icon class="h-3.5 w-3.5" />
			{/if}
			{opt.label}
		</button>
	{/each}
</div>
