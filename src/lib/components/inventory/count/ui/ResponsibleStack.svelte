<script lang="ts">
	import { initialsFor } from '$lib/shared/inventoryCount';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Responsible {
		id: number;
		userId: string | null;
		displayName: string;
		isExternal: boolean;
	}

	interface Props {
		responsibles: Responsible[];
		/** Si es true y editable, la pila abre el panel de responsables. */
		editable?: boolean;
		tooltipTitle?: string;
		onOpenEdit?: () => void;
	}

	let {
		responsibles,
		editable = false,
		tooltipTitle = 'Responsables',
		onOpenEdit
	}: Props = $props();

	const list = $derived(responsibles.slice(0, 3));
	const rest = $derived(Math.max(responsibles.length - 3, 0));
	const names = $derived(
		responsibles
			.map((entry) => `${entry.displayName}${entry.isExternal ? ' (externo)' : ''}`)
			.join(', ')
	);
</script>

{#if editable}
	<TriggerTooltip title={tooltipTitle} text={names + '. Clic para editar.'}>
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				class="inline-flex items-center"
				aria-label="Editar responsables"
				onclick={() => onOpenEdit?.()}
			>
				{#each list as entry (entry.id)}
					<span
						class="inline-grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] border-brand-navy bg-brand-blue text-[11px] font-bold text-brand-navy"
						style="margin-left:-6px">{initialsFor(entry.displayName)}</span
					>
				{/each}
				{#if rest > 0}
					<span
						class="inline-grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] border-brand-navy bg-brand-blue text-[11px] font-bold text-brand-navy"
						style="margin-left:-6px">+{rest}</span
					>
				{/if}
				<span
					class="inline-grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] border-brand-navy bg-white text-sm text-brand-navy"
					style="margin-left:-6px">＋</span
				>
			</button>
		{/snippet}
	</TriggerTooltip>
{:else}
	<TriggerTooltip title={tooltipTitle} text={names}>
		{#snippet trigger({ props })}
			<button
				type="button"
				{...props}
				class="inline-flex items-center p-0"
				aria-label={tooltipTitle}
			>
				{#each list as entry (entry.id)}
					<span
						class="inline-grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] border-brand-navy bg-brand-blue text-[11px] font-bold text-brand-navy"
						style="margin-left:-6px">{initialsFor(entry.displayName)}</span
					>
				{/each}
				{#if rest > 0}
					<span
						class="inline-grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] border-brand-navy bg-brand-blue text-[11px] font-bold text-brand-navy"
						style="margin-left:-6px">+{rest}</span
					>
				{/if}
			</button>
		{/snippet}
	</TriggerTooltip>
{/if}
