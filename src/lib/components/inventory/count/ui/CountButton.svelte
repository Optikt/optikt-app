<script lang="ts">
	import type { Snippet } from 'svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		variant?: 'gold' | 'navy' | 'ghost';
		/** Contenido del botón. */
		child: Snippet;
		/** Tooltip con el motivo cuando está deshabilitado (uso `aria-disabled` + guard). */
		disabledTooltip?: string;
		title?: string;
		onclick?: () => void;
		/** `disabled` de verdad (solo cuando la explicación no hace falta). */
		disabled?: boolean;
		class?: string;
		type?: 'button' | 'submit';
	}

	let {
		variant = 'gold',
		child,
		disabledTooltip,
		title,
		onclick,
		disabled = false,
		class: className = '',
		type = 'button'
	}: Props = $props();

	let softDisabled = $derived(disabled === true && !disabledTooltip);

	const variantClasses: Record<string, string> = {
		gold: 'bg-brand-gold text-brand-navy hover:bg-brand-gold-dark',
		navy: 'bg-brand-navy text-white hover:bg-brand-navy-dark',
		ghost:
			'border border-outline-variant/35 bg-surface-container-lowest text-on-surface hover:bg-surface-container'
	};

	function handleClick(event: MouseEvent): void {
		if (disabled) {
			event.preventDefault();
			return;
		}
		onclick?.();
	}
</script>

{#if disabledTooltip}
	<TriggerTooltip {title} text={disabledTooltip}>
		{#snippet trigger({ props })}
			<button
				{...props}
				{type}
				aria-disabled="true"
				class={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${variantClasses[variant]} cursor-not-allowed opacity-60 ${className}`}
				onclick={handleClick}
			>
				{@render child()}
			</button>
		{/snippet}
	</TriggerTooltip>
{:else}
	<button
		{type}
		{title}
		class={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${variantClasses[variant]} ${disabled ? 'opacity-60' : ''} ${className}`}
		{disabled}
		onclick={handleClick}
	>
		{@render child()}
	</button>
{/if}
