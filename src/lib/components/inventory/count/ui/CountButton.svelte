<script lang="ts">
	import type { Snippet } from 'svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { splitTooltip } from '$lib/utils/tooltip';

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
		/** Se invoca al hacer click estando deshabilitado (para dar feedback). */
		onBlockedClick?: () => void;
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
		onBlockedClick,
		class: className = '',
		type = 'button'
	}: Props = $props();

	const blockedTip = $derived(splitTooltip(disabledTooltip));

	const variantClasses: Record<string, string> = {
		gold: 'bg-brand-gold text-brand-navy hover:bg-brand-gold-dark',
		navy: 'bg-brand-navy text-white hover:bg-brand-navy-dark',
		ghost:
			'border border-outline-variant/35 bg-surface-container-lowest text-on-surface hover:bg-surface-container'
	};

	function handleClick(event: MouseEvent): void {
		if (disabled) {
			event.preventDefault();
			onBlockedClick?.();
			return;
		}
		onclick?.();
	}
</script>

{#if disabled && disabledTooltip}
	<TriggerTooltip title={blockedTip.title ?? title} text={blockedTip.text}>
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
