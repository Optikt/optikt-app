<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { CountSessionStats } from '$lib/shared/inventoryCount';
	import { formatUsd } from '$lib/shared/inventoryCount';

	interface Props {
		stats: CountSessionStats;
	}

	let { stats }: Props = $props();
</script>

<div
	class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-outline-variant/40 px-4 py-2 text-sm text-on-surface-variant"
>
	<TriggerTooltip title="Pendientes" text="Ítems con stock en el sistema que aún no cuentas.">
		{#snippet trigger({ props })}
			<button type="button" {...props} class="p-0"
				>Pendientes <b class="font-heading text-brand-navy">{stats.pendingCounting}</b></button
			>
		{/snippet}
	</TriggerTooltip>
	<TriggerTooltip title="Coinciden" text="Lo contado es igual al sistema.">
		{#snippet trigger({ props })}
			<button type="button" {...props} class="p-0"
				>Coinciden <b class="font-heading text-brand-navy">{stats.matchCount}</b></button
			>
		{/snippet}
	</TriggerTooltip>
	<TriggerTooltip
		title="Con diferencia"
		text={`Faltan ${stats.missingUnits} u y sobran ${stats.surplusUnits} u en total.`}
	>
		{#snippet trigger({ props })}
			<button type="button" {...props} class="p-0">
				Con diferencia <b class="font-heading text-brand-navy">{stats.diffCount}</b>
				<span class="tabular-nums">(−{stats.missingUnits} / +{stats.surplusUnits})</span>
			</button>
		{/snippet}
	</TriggerTooltip>
	<TriggerTooltip
		title="Impacto estimado"
		text="Diferencia × costo de cada ítem. Negativo = pérdida."
	>
		{#snippet trigger({ props })}
			<button type="button" {...props} class="p-0"
				>Impacto est. <b class="font-heading text-brand-navy">{formatUsd(stats.impactCost)}</b
				></button
			>
		{/snippet}
	</TriggerTooltip>
	{#if stats.zeroStockPending > 0}
		<TriggerTooltip
			title="Stock 0 sin confirmar"
			text="No bloquea el cierre, pero esos ítems no quedan como verificados."
		>
			{#snippet trigger({ props })}
				<button type="button" {...props} class="p-0"
					>Stock 0 sin confirmar <b class="font-heading text-brand-navy">{stats.zeroStockPending}</b
					></button
				>
			{/snippet}
		</TriggerTooltip>
	{/if}
</div>
