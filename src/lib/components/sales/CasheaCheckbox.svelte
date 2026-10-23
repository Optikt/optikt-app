<script lang="ts">
	import { CasheaIsotipo } from '$lib/components/branding';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	let {
		isCashea = $bindable(false),
		label = 'Venta con Cashea',
		disabled = false,
		variant = 'default' as 'default' | 'gold',
		compact = false,
		infoText = 'Activa esta opción si el cliente pagará a través de Cashea. Se guarda en la venta para su seguimiento.',
		class: className = ''
	}: {
		isCashea?: boolean;
		label?: string;
		disabled?: boolean;
		variant?: 'default' | 'gold';
		/** Compact control: checkbox + logo only, with a tooltip. */
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
