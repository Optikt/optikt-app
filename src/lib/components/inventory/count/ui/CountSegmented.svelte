<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface TabOption {
		value: string;
		label: string;
		tooltip?: string;
	}

	interface Props {
		options: TabOption[];
		value: string;
		disabled?: boolean;
		ariaLabel?: string;
		onchange?: (value: string) => void;
	}

	let { options, value, disabled = false, ariaLabel = '', onchange }: Props = $props();
</script>

<div
	class="inline-flex gap-0.5 rounded-lg bg-surface-container p-0.5 {disabled ? 'opacity-60' : ''}"
	role="group"
	aria-label={ariaLabel}
>
	{#each options as option (option.value)}
		<TriggerTooltip text={option.tooltip} side="top">
			{#snippet trigger({ props })}
				<button
					{...props}
					type="button"
					class={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
						value === option.value
							? 'bg-white text-brand-navy shadow-sm'
							: 'text-on-surface-variant hover:text-brand-navy'
					}`}
					{disabled}
					aria-pressed={value === option.value}
					onclick={() => onchange?.(option.value)}
				>
					{option.label}
				</button>
			{/snippet}
		</TriggerTooltip>
	{/each}
</div>
