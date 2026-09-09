<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { Info } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import type { OpticalRangeFormEntry, OpticalRangeValidation } from '$lib/utils/opticalRangeForm';
	import {
		SPHERE_RANGE_MODE,
		createEmptyOpticalRangeValidation,
		getOpticalRangePreview
	} from '$lib/utils/opticalRangeForm';
	import { LensCatalogSource } from '$lib/shared/enums';
	import {
		formCardClass,
		sectionTitleClass,
		fieldLabelClass,
		rangeSubLabelClass,
		rangeHeaderRowClass,
		rangeHeaderRowWithToggleClass
	} from './lensFormClasses';
	import { getRangeInputClass, mergeRangeValidation } from './lensFormRanges';

	interface Props {
		ranges: OpticalRangeFormEntry[];
		clientValidations: OpticalRangeValidation[];
		serverValidations: (OpticalRangeValidation | undefined)[];
		rootRangeIssues: RemoteFormIssue[];
		showAddition: boolean;
		source: LensCatalogSource;
		onAddRange: () => void;
		onRemoveRange: (index: number) => void;
		onToggleSphereMode: (range: OpticalRangeFormEntry) => void;
	}

	let {
		ranges,
		clientValidations,
		serverValidations,
		rootRangeIssues,
		showAddition,
		source,
		onAddRange,
		onRemoveRange,
		onToggleSphereMode
	}: Props = $props();
</script>

<section class={formCardClass}>
	<div class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-2">
			<span class="h-2 w-2 rounded-full bg-brand-blue"></span>
			<h3 class={sectionTitleClass}>Rangos opticos</h3>
			<span class="group relative cursor-help">
				<Info class="h-4 w-4 text-outline" />
				<span
					class="absolute bottom-full left-1/2 z-50 mb-2 hidden w-72 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-sm text-white shadow-lg group-hover:block"
				>
					<p class="mb-1 font-medium">¿Qué son los rangos?</p>
					<p>
						Definen qué graduaciones puede cubrir este cristal. La esfera puede ser continua
						como -4.00 a +4.00, o un duplicado inverso como ±4.00 a ±2.00, que guarda dos
						rangos espejo y deja libre el centro.
					</p>
				</span>
			</span>
		</div>
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-brand-blue transition-colors hover:bg-info-container/35 hover:text-brand-navy"
			onclick={onAddRange}
		>
			<span aria-hidden="true">+</span>
			Agregar rango
		</button>
	</div>

	<div class="mt-6 space-y-4" use:autoAnimate>
		{#if ranges.length === 0}
			<div class="rounded-xl bg-surface-container-low px-6 py-8 text-center">
				<p class="text-sm text-on-surface-variant">
					{source === LensCatalogSource.LAB
						? 'Sin rangos definidos. El laboratorio confirmará disponibilidad por pedido.'
						: 'Agrega al menos un rango para este lente terminado.'}
				</p>
			</div>
		{/if}

		{#each ranges as range, i (i)}
			{@const rangeValidation = mergeRangeValidation(
				clientValidations[i] ?? createEmptyOpticalRangeValidation(),
				serverValidations[i]
			)}
			{@const sphereErrors = rangeValidation.sphere}
			{@const cylinderErrors = rangeValidation.cylinder}
			{@const additionErrors = rangeValidation.addition}
			{@const sphereHasErrors = sphereErrors.length > 0}
			{@const cylinderHasErrors = cylinderErrors.length > 0}
			{@const additionHasErrors = additionErrors.length > 0}
			{@const previewLines = getOpticalRangePreview(range)}
			{@const sphereStartLabel =
				range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE ? 'Exterior' : 'Desde'}
			{@const sphereEndLabel =
				range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE ? 'Interior' : 'Hasta'}
			<div class="rounded-xl bg-surface-container-low p-5" use:autoAnimate>
				<div class="grid gap-4 lg:grid-cols-12">
					<div class={showAddition ? 'lg:col-span-4' : 'lg:col-span-6'}>
						<div class={rangeHeaderRowWithToggleClass}>
							<Label class={fieldLabelClass}>Esfera (ESF)</Label>
							<span class="group relative">
								<button
									type="button"
									aria-pressed={range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE}
									class="inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs leading-none font-semibold transition-colors {range.sphereMode ===
									SPHERE_RANGE_MODE.INVERSE_DUPLICATE
										? 'border-brand-blue/60 bg-brand-navy text-white'
										: 'border-outline-variant/40 bg-white text-brand-navy hover:border-brand-blue/40 hover:text-brand-blue'}"
									onclick={() => onToggleSphereMode(range)}
								>
									±
								</button>
								<span
									class="absolute bottom-full left-1/2 z-50 mb-2 hidden w-72 -translate-x-1/2 rounded-lg bg-slate-800 p-3 text-sm text-white shadow-lg group-hover:block"
								>
									<p class="font-medium text-white">
										{range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE
											? 'Duplicado inverso activado'
											: 'Duplicado inverso desactivado'}
									</p>
									<p class="mt-1 text-white/80">
										{range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE
											? 'Los campos pasan a ser ± exterior e ± interior, y al guardar se crean dos rangos espejo.'
											: 'Los campos se leen como desde y hasta, y al guardar se crea un solo rango continuo.'}
									</p>
								</span>
							</span>
						</div>
						<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
							{#if range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE}
								<div>
									<p class={rangeSubLabelClass}>{sphereStartLabel}</p>
									<input
										bind:value={range.inverseOuter}
										aria-invalid={sphereHasErrors}
										type="number"
										min="0"
										max="30"
										step="0.25"
										placeholder="4.00"
										class={getRangeInputClass(sphereHasErrors)}
									/>
								</div>
							{:else}
								<div>
									<p class={rangeSubLabelClass}>{sphereStartLabel}</p>
									<input
										bind:value={range.sphereMin}
										aria-invalid={sphereHasErrors}
										type="number"
										min="-30"
										max="30"
										step="0.25"
										placeholder="-4.00"
										class={getRangeInputClass(sphereHasErrors)}
									/>
								</div>
							{/if}
							<span class="pb-2 text-xs text-outline">/</span>
							{#if range.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE}
								<div>
									<p class={rangeSubLabelClass}>{sphereEndLabel}</p>
									<input
										bind:value={range.inverseInner}
										aria-invalid={sphereHasErrors}
										type="number"
										min="0"
										max="30"
										step="0.25"
										placeholder="2.00"
										class={getRangeInputClass(sphereHasErrors)}
									/>
								</div>
							{:else}
								<div>
									<p class={rangeSubLabelClass}>{sphereEndLabel}</p>
									<input
										bind:value={range.sphereMax}
										aria-invalid={sphereHasErrors}
										type="number"
										min="-30"
										max="30"
										step="0.25"
										placeholder="+4.00"
										class={getRangeInputClass(sphereHasErrors)}
									/>
								</div>
							{/if}
						</div>
						{#if sphereErrors.length > 0}
							<div class="mt-2 space-y-1">
								{#each sphereErrors as err (`sphere-${i}-${err}`)}
									<p class="text-xs text-error">{err}</p>
								{/each}
							</div>
						{/if}
					</div>

					<div class={showAddition ? 'lg:col-span-4' : 'lg:col-span-6'}>
						<div class={rangeHeaderRowClass}>
							<Label class={fieldLabelClass}>Cilindro (CIL)</Label>
						</div>
						<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
							<div>
								<p class={rangeSubLabelClass}>Minimo</p>
								<input
									bind:value={range.cylinderMin}
									aria-invalid={cylinderHasErrors}
									type="number"
									min="-10"
									max="0"
									step="0.25"
									placeholder="Min"
									class={getRangeInputClass(cylinderHasErrors)}
								/>
							</div>
							<span class="pb-2 text-xs text-outline">/</span>
							<div>
								<p class={rangeSubLabelClass}>Maximo</p>
								<input
									bind:value={range.cylinderMax}
									aria-invalid={cylinderHasErrors}
									type="number"
									min="-10"
									max="0"
									step="0.25"
									placeholder="Max"
									class={getRangeInputClass(cylinderHasErrors)}
								/>
							</div>
						</div>
						{#if cylinderErrors.length > 0}
							<div class="mt-2 space-y-1">
								{#each cylinderErrors as err (`cylinder-${i}-${err}`)}
									<p class="text-xs text-error">{err}</p>
								{/each}
							</div>
						{/if}
					</div>

					{#if showAddition}
						<div class="lg:col-span-4">
							<div class={rangeHeaderRowClass}>
								<Label class={fieldLabelClass}>Adicion (ADD)</Label>
							</div>
							<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
								<div>
									<p class={rangeSubLabelClass}>Minimo</p>
									<input
										bind:value={range.additionMin}
										aria-invalid={additionHasErrors}
										type="number"
										min="0"
										max="5"
										step="0.25"
										placeholder="Min"
										class={getRangeInputClass(additionHasErrors)}
									/>
								</div>
								<span class="pb-2 text-xs text-outline">/</span>
								<div>
									<p class={rangeSubLabelClass}>Maximo</p>
									<input
										bind:value={range.additionMax}
										aria-invalid={additionHasErrors}
										type="number"
										min="0"
										max="5"
										step="0.25"
										placeholder="Max"
										class={getRangeInputClass(additionHasErrors)}
									/>
								</div>
							</div>
							{#if additionErrors.length > 0}
								<div class="mt-2 space-y-1">
									{#each additionErrors as err (`addition-${i}-${err}`)}
										<p class="text-xs text-error">{err}</p>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div
					class="mt-4 flex items-end justify-between gap-3 border-t border-outline-variant/20 pt-4"
				>
					<div class="space-y-1">
						<p class={fieldLabelClass}>Resultado</p>
						{#each previewLines as line, li (`${i}-${li}`)}
							<p class="font-mono leading-tight font-semibold text-on-surface tabular-nums">
								{line}
							</p>
						{/each}
					</div>
					<button
						type="button"
						class="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:text-error"
						onclick={() => onRemoveRange(i)}>Quitar</button
					>
				</div>
			</div>
		{/each}

		{#if rootRangeIssues.length > 0}
			<div class="space-y-1">
				{#each rootRangeIssues as issue, issueIndex (`range-root-${issueIndex}-${issue.message}`)}
					<p class="text-xs text-error">{issue.message}</p>
				{/each}
			</div>
		{/if}
	</div>
</section>
