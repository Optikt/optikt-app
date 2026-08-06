<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fieldLabelClass } from '../purchaseFieldStyles';

	interface Props {
		label: string;
		required?: boolean;
		error?: string;
		hint?: string;
		class?: string;
		id?: string;
		children: Snippet;
	}

	let {
		label,
		required = false,
		error,
		hint,
		class: className = '',
		id,
		children
	}: Props = $props();
</script>

<div class="space-y-1.5 {className}">
	{#if label}
		{#if id}
			<label for={id} class="block {fieldLabelClass}">
				{label}
				{#if required}<span class="text-error"> *</span>{/if}
			</label>
		{:else}
			<span class="block {fieldLabelClass}">
				{label}
				{#if required}<span class="text-error"> *</span>{/if}
			</span>
		{/if}
	{/if}
	{@render children()}
	{#if error}
		<p class="text-xs text-error">{error}</p>
	{/if}
	{#if hint}
		<p class="text-xs text-on-surface-variant">{hint}</p>
	{/if}
</div>
