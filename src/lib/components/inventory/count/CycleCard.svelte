<script lang="ts">
	import CoverageBar from './ui/CoverageBar.svelte';
	import CountLabel from './ui/CountLabel.svelte';
	import CountButton from './ui/CountButton.svelte';

	interface Props {
		summary: {
			itemCount: number;
			okCount: number;
			soonCount: number;
			overCount: number;
			neverCounted: number;
			verifiedPercent: number;
			lastFullCycleAt: string | null;
		};
		cycleDays: number;
		quickOldestLimit: number;
		onQuickOldest: () => void;
		onQuickNever: () => void;
	}

	let { summary, cycleDays, quickOldestLimit, onQuickOldest, onQuickNever }: Props = $props();

	const segments = $derived([
		{
			key: 'ok' as const,
			value: summary.okCount,
			title: 'Al día',
			hint: 'Contado dentro del 75 % del plazo.'
		},
		{
			key: 'soon' as const,
			value: summary.soonCount,
			title: 'Por vencer',
			hint: 'Entre el 75 % y el 100 % del plazo.'
		},
		{
			key: 'over' as const,
			value: summary.overCount,
			title: 'Vencidos',
			hint: 'Superó el plazo del ciclo.'
		},
		{
			key: 'none' as const,
			value: summary.neverCounted,
			title: 'Nunca contados',
			hint: 'Nunca estuvo en un conteo cerrado.'
		}
	]);
</script>

<section class="rounded-xl bg-white p-4 shadow-[var(--ds-shadow-md)]">
	<CountLabel
		text={`Ciclo · ${cycleDays} días`}
		tooltip="Ciclo móvil|Porcentaje de ítems verificados en un conteo cerrado dentro del plazo. Ventas, compras y ajustes no lo reinician."
	/>

	<div class="mt-2 flex flex-wrap items-center gap-4">
		<span class="font-heading text-[40px] leading-none font-bold text-brand-navy">
			{summary.verifiedPercent} %
		</span>
		<span class="text-sm text-on-surface-variant">verificado</span>
		<CoverageBar {segments} />
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-on-surface-variant">
		<span class="inline-flex items-center gap-1.5">
			<i class="h-2.5 w-2.5 rounded-full bg-success"></i>
			{summary.okCount} al día
		</span>
		<span class="inline-flex items-center gap-1.5">
			<i class="h-2.5 w-2.5 rounded-full bg-warning"></i>
			{summary.soonCount} por vencer
		</span>
		<span class="inline-flex items-center gap-1.5">
			<i class="h-2.5 w-2.5 rounded-full bg-error"></i>
			{summary.overCount} vencidos
		</span>
		<span class="inline-flex items-center gap-1.5">
			<i class="h-2.5 w-2.5 rounded-full border-[1.5px] border-outline"></i>
			{summary.neverCounted} nunca
		</span>
		<span class="ml-auto text-on-surface-variant">
			Último ciclo completo: {summary.lastFullCycleAt ? summary.lastFullCycleAt : '—'}
		</span>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-3 border-t border-outline-variant/20 pt-3">
		<CountLabel
			text="Atajos sobre todo el inventario"
			tooltip="Atajos|Se eligen entre todos los ítems, sin importar la marca o el proveedor que tengas seleccionado abajo."
		/>
		<CountButton variant="ghost" onclick={onQuickOldest}>
			{#snippet child()}Más atrasados · {quickOldestLimit}{/snippet}
		</CountButton>
		<CountButton variant="ghost" onclick={onQuickNever}>
			{#snippet child()}Nunca contados · {summary.neverCounted}{/snippet}
		</CountButton>
	</div>
</section>
