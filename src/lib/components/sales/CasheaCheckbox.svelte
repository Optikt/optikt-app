<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { CasheaIsotipo } from '$lib/components/branding';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	let {
		isCashea = $bindable(false),
		label = 'Venta con Cashea',
		hint = 'Financia el saldo a través de Cashea',
		disabled = false,
		variant = 'default' as 'default' | 'gold',
		size = 'sm' as 'sm' | 'md' | 'lg',
		compact = false,
		infoText = 'Activa esta opción si el cliente pagará a través de Cashea. Se guarda en la venta para su seguimiento.',
		class: className = ''
	}: {
		isCashea?: boolean;
		label?: string;
		/** Supporting line shown only in the `lg` (option card) layout */
		hint?: string;
		disabled?: boolean;
		variant?: 'default' | 'gold';
		/** sm: payment rail · md: XL chip · lg: full-width option card */
		size?: 'sm' | 'md' | 'lg';
		/** Logo + checkbox only, with an explanatory tooltip (edit drawer). */
		compact?: boolean;
		infoText?: string;
		class?: string;
	} = $props();

	const bg = $derived(variant === 'gold' ? 'bg-brand-gold/10' : 'bg-surface-container/60');
</script>

{#if compact}
	{#snippet casheaTrigger({ props }: { props: Record<string, unknown> })}
		<label
			{...props}
			class="inline-flex cursor-pointer items-center gap-2 rounded-lg {bg} px-2.5 py-2 {className}"
		>
			<input
				type="checkbox"
				bind:checked={isCashea}
				{disabled}
				aria-label={label}
				class="h-4 w-4 shrink-0 accent-brand-blue"
			/>
			<CasheaIsotipo class="h-7 w-7 shrink-0" />
		</label>
	{/snippet}
	<TriggerTooltip title={label} text={infoText} trigger={casheaTrigger} side="bottom" />
{:else if size === 'lg'}
	<label
		class="flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-brand-blue/30 {isCashea
			? 'border-brand-gold bg-brand-gold/10'
			: 'border-outline-variant/40 bg-surface-container-lowest hover:border-outline-variant'} {disabled
			? 'cursor-not-allowed opacity-70'
			: ''} {className}"
	>
		<input type="checkbox" bind:checked={isCashea} {disabled} class="sr-only" />
		<span
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-outline-variant/30"
		>
			<CasheaIsotipo class="h-9 w-9" />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block text-sm font-semibold text-on-surface">{label}</span>
			<span class="block text-[11px] leading-tight text-on-surface-variant">{hint}</span>
		</span>
		<span
			class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 {isCashea
				? 'border-brand-gold bg-brand-gold text-brand-navy'
				: 'border-outline-variant/60 bg-surface-container-lowest text-transparent'}"
			aria-hidden="true"
		>
			<Check class="h-4 w-4" strokeWidth={3} />
		</span>
	</label>
{:else if size === 'md'}
	<label
		class="inline-flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-150 focus-within:ring-2 focus-within:ring-brand-blue/30 {isCashea
			? 'bg-brand-gold/15 text-brand-navy ring-1 ring-brand-gold'
			: 'bg-surface-container/60 text-on-surface hover:bg-surface-container'} {disabled
			? 'cursor-not-allowed opacity-70'
			: ''} {className}"
	>
		<CasheaIsotipo class="h-6 w-6 shrink-0" />
		<span>{label}</span>
		<input
			type="checkbox"
			bind:checked={isCashea}
			{disabled}
			class="h-4 w-4 shrink-0 accent-brand-blue"
		/>
	</label>
{:else}
	<label
		class="flex items-center gap-2 rounded-lg {bg} px-3 py-2.5 text-xs text-on-surface-variant {className}"
	>
		<input
			type="checkbox"
			bind:checked={isCashea}
			{disabled}
			class="h-4 w-4 shrink-0 accent-brand-blue"
		/>
		<CasheaIsotipo class="h-4 w-4 shrink-0" />
		<span class="font-medium text-on-surface">{label}</span>
	</label>
{/if}
