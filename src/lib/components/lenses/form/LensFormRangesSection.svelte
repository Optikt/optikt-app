<script lang="ts">
	import type { OpticalRangeFormEntry, OpticalRangeValidation } from '$lib/utils/opticalRangeForm';
	import { SPHERE_RANGE_MODE } from '$lib/utils/opticalRangeForm';
	import { getRangeInputClass, toggleSphereMode } from './lensFormRanges';

	interface Props {
		ranges: OpticalRangeFormEntry[];
		validations: OpticalRangeValidation[];
		onAddRange: () => void;
		onRemoveRange: (index: number) => void;
	}

	let { ranges = $bindable(), validations, onAddRange, onRemoveRange }: Props = $props();

	function hasErrorForRange(index: number, group: 'sphere' | 'cylinder' | 'addition'): boolean {
		return (validations[index]?.[group]?.length ?? 0) > 0;
	}
</script>

<section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="font-heading text-lg font-semibold text-on-surface">Rangos opticos</h3>
		<button type="button" onclick={onAddRange} class="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-navy-dark">Agregar rango</button>
	</div>
	{#if ranges.length === 0}
		<p class="py-4 text-center text-sm text-slate-400">No hay rangos. Agregue uno para cristales terminados.</p>
	{:else}
		<div class="space-y-4">
			{#each ranges as range, i (i)}
				<div class="rounded-lg border border-slate-200 p-4 dark:border-slate-600">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-bold text-slate-600 dark:text-slate-300">Rango {i + 1}</span>
						<div class="flex gap-1">
							<button type="button" onclick={() => toggleSphereMode(range)} class="rounded px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600">
								{range.sphereMode === SPHERE_RANGE_MODE.CONTINUOUS ? 'Continuo' : 'Inverso'}
							</button>
							<button type="button" onclick={() => onRemoveRange(i)} class="rounded px-2 py-1 text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">Eliminar</button>
						</div>
					</div>
					<div class="grid gap-3 md:grid-cols-3">
						<div>
							<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Esfera min</label>
							<input type="number" bind:value={range.sphereMin} step="0.25" class={getRangeInputClass(hasErrorForRange(i, 'sphere'))} />
							{#if validations[i]?.sphere?.length}<p class="mt-1 text-xs text-red-600">{validations[i].sphere[0]}</p>{/if}
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Esfera max</label>
							<input type="number" bind:value={range.sphereMax} step="0.25" class={getRangeInputClass(hasErrorForRange(i, 'sphere'))} />
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Cilindro min</label>
							<input type="number" bind:value={range.cylinderMin} step="0.25" class={getRangeInputClass(hasErrorForRange(i, 'cylinder'))} />
							{#if validations[i]?.cylinder?.length}<p class="mt-1 text-xs text-red-600">{validations[i].cylinder[0]}</p>{/if}
						</div>
					</div>
					<div class="mt-3 grid gap-3 md:grid-cols-2">
						<div>
							<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Adición min</label>
							<input type="number" bind:value={range.additionMin} step="0.25" class={getRangeInputClass(hasErrorForRange(i, 'addition'))} />
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Adición max</label>
							<input type="number" bind:value={range.additionMax} step="0.25" class={getRangeInputClass(hasErrorForRange(i, 'addition'))} />
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
