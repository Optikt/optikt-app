<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		label?: string;
		error?: string | string[];
		hint?: string;
		class?: string;
		value?: string;
	}

	let {
		label,
		error,
		hint,
		class: className = '',
		id: inputId = `input-${Math.random().toString(36).slice(2)}`,
		value = $bindable(''),
		...restProps
	}: Props = $props();

	const errorMessage = $derived(Array.isArray(error) ? error[0] : error);
	const hasError = $derived(!!errorMessage);
</script>

<div class="flex flex-col gap-2 {className}">
	{#if label}
		<label for={inputId} class="form-label">
			{label}
		</label>
	{/if}

	<input
		id={inputId}
		class="input-field {hasError ? 'input-error' : ''}"
		aria-invalid={hasError}
		aria-describedby={hasError ? `${inputId}-error` : undefined}
		bind:value
		{...restProps}
	/>

	{#if hasError}
		<p id="{inputId}-error" class="m-0 text-[0.8125rem] text-red-500">
			{errorMessage}
		</p>
	{:else if hint}
		<p class="m-0 text-[0.8125rem] text-slate-500">{hint}</p>
	{/if}
</div>
