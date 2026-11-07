<script lang="ts">
	import { CheckSquare, Square } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import CountSegmented from './ui/CountSegmented.svelte';
	import CountLabel from './ui/CountLabel.svelte';
	import CountButton from './ui/CountButton.svelte';
	import TrafficDot from './ui/TrafficDot.svelte';
	import { formatAgo, TRAFFIC_STATE_LABELS, TRAFFIC_STATE_HINTS } from '$lib/shared/inventoryCount';
	import type { CoverageDim, CoverageData } from '$lib/server/db/queries/inventoryCount/coverage';

	interface Props {
		dim: CoverageDim;
		groups: CoverageData['groups'];
		selectedValues: string[];
		onDimChange: (dim: CoverageDim) => void;
		onToggleRow: (value: string) => void;
		onClearSelection: () => void;
		onCountSelection: () => void;
	}

	let {
		dim,
		groups,
		selectedValues,
		onDimChange,
		onToggleRow,
		onClearSelection,
		onCountSelection
	}: Props = $props();

	function groupCount(values: string[]): number {
		return groups[dim]
			.filter((group) => values.includes(group.value))
			.reduce((sum, group) => sum + group.itemCount, 0);
	}
</script>

<section class="rm:overflow-hidden rounded-xl bg-white p-4 shadow-[var(--ds-shadow-md)]">
	<div class="flex flex-wrap items-center gap-2">
		<CountSegmented
			value={dim}
			ariaLabel="Agrupar por dimensión"
			options={[
				{
					value: 'BRAND',
					label: 'Marca',
					tooltip: 'Agrupar por marca|Marca varias filas para contarlas juntas.'
				},
				{
					value: 'SUPPLIER',
					label: 'Proveedor',
					tooltip: 'Agrupar por proveedor|Marca varias filas para contarlas juntas.'
				},
				{
					value: 'TYPE',
					label: 'Tipo',
					tooltip: 'Agrupar por tipo|Marca varias filas para contarlas juntas.'
				}
			]}
			onchange={(value) => onDimChange(value as CoverageDim)}
		/>
		<span class="ml-auto text-xs text-on-surface-variant">Marca filas para armar un conteo</span>
	</div>

	<div
		class="grid grid-cols-[28px_1.3fr_.5fr_1.2fr_.5fr_1.3fr_30px_.6fr] items-center gap-2.5 border-t border-outline-variant/40 pt-2 pb-1"
	>
		<span></span>
		<CountLabel text="Nombre" />
		<CountLabel text="Ítems" />
		<CountLabel text="Verificado" />
		<CountLabel text="%" />
		<CountLabel text="Antigüedad" />
		<span></span>
		<CountLabel text="Mov." />
	</div>

	{#if groups[dim]!.length === 0}
		<p class="py-6 text-center text-sm text-on-surface-variant">
			Sin grupos eligibles para esta dimensión
		</p>
	{:else}
		<div class="divide-y divide-outline-variant/40">
			{#each groups[dim]! as group (group.value)}
				<button
					type="button"
					class="grid w-full grid-cols-[28px_1.3fr_.5fr_1.2fr_.5fr_1.3fr_30px_.6fr] items-center gap-2.5 border-t border-outline-variant/40 px-1.5 py-3 text-left transition-colors hover:bg-surface-container-low"
					onclick={() => onToggleRow(group.value)}
					aria-pressed={selectedValues.includes(group.value)}
				>
					<span class="inline-flex items-center" aria-hidden="true">
						{#if selectedValues.includes(group.value)}
							<CheckSquare class="h-4 w-4 text-brand-navy" />
						{:else}
							<Square class="h-4 w-4 text-outline-variant" />
						{/if}
					</span>
					<span class="truncate text-sm font-semibold text-brand-navy">{group.name}</span>
					<span class="text-sm text-on-surface-variant">{group.itemCount}</span>
					<span class="h-2 overflow-hidden rounded bg-surface-container">
						<span
							class="block h-full rounded bg-brand-navy"
							style={`width:${group.verifiedPercent}%`}
						></span>
					</span>
					<span class="text-sm text-on-surface-variant">{group.verifiedPercent} %</span>
					<TriggerTooltip
						title="Antigüedad"
						text="Mediana de días desde el último conteo: la mitad del grupo se contó hace menos que esto."
					>
						{#snippet trigger({ props })}
							<span {...props} tabindex="0" class="text-sm text-on-surface-variant">
								{group.medianAgeDays == null
									? 'Nunca'
									: `mediana ${formatAgo(group.medianAgeDays)}`}
							</span>
						{/snippet}
					</TriggerTooltip>
					<TrafficDot
						state={group.trafficState}
						title={TRAFFIC_STATE_LABELS[group.trafficState]}
						hint={group.trafficState === 'none'
							? 'Ningún ítem del grupo fue contado todavía.'
							: TRAFFIC_STATE_HINTS[group.trafficState]}
					/>
					<TriggerTooltip
						title="Movimientos"
						text="Ventas, compras y ajustes desde el último conteo. Más movimiento, más riesgo de desfase."
					>
						{#snippet trigger({ props })}
							<span {...props} tabindex="0" class="text-sm text-on-surface-variant"
								>{group.movementsSince}</span
							>
						{/snippet}
					</TriggerTooltip>
				</button>
			{/each}
		</div>
	{/if}

	{#if selectedValues.length > 0}
		<div
			class="ani-in mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-brand-navy px-4 py-2.5 text-sm text-white"
		>
			<b>{selectedValues.length} seleccionado{selectedValues.length === 1 ? '' : 's'}</b>
			<span class="flex-1">· {groupCount(selectedValues)} ítems</span>
			<button
				type="button"
				class="font-semibold text-white/70 transition-colors hover:text-white"
				onclick={onClearSelection}
			>
				Limpiar
			</button>
			<CountButton variant="gold" class="!px-3 !py-1.5" onclick={onCountSelection}>
				{#snippet child()}Contar selección →{/snippet}
			</CountButton>
		</div>
	{/if}
</section>
