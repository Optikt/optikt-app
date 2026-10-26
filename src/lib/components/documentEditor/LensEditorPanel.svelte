<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Check, FlaskConical, Save, TriangleAlert, X } from '@lucide/svelte';
	import { DiscountType } from '$lib/shared/enums';
	import { LensType } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';

	import {
		evaluateLensEditorRange,
		hasLensEditorErrors,
		treatmentTotal,
		validateLensEditorDraft
	} from './lensEditor';
	import LensEyeFields from './LensEyeFields.svelte';
	import type { LensEditorDraft } from './types';
	import type { OpticalRangeBounds } from './opticalRange';

	interface Props {
		mode: 'add' | 'edit';
		draft: LensEditorDraft;
		/** Lens type of the selected catalog item (drives addition/height inputs). */
		lensType: string;
		ranges: OpticalRangeBounds[];
		selectableTreatments: { id: string; name: string; price: number; salePrice?: number | null }[];
		/** Lens catalog selector rendered by the adapter (keeps this panel domain-free). */
		lensSelector: Snippet;
		onAddTreatment: (id: string) => void;
		onRemoveTreatment: (idx: number) => void;
		onApply: () => void;
		onCancel: () => void;
	}

	let {
		mode,
		draft = $bindable(),
		lensType,
		ranges,
		selectableTreatments,
		lensSelector,
		onAddTreatment,
		onRemoveTreatment,
		onApply,
		onCancel
	}: Props = $props();

	const showAddition = $derived(lensType !== '' && lensType !== LensType.MONOFOCAL);
	const requiresAddition = $derived(showAddition);
	const errors = $derived(validateLensEditorDraft(draft, { requiresAddition }));
	const hasErrors = $derived(hasLensEditorErrors(errors));
	const rangeEvaluation = $derived(evaluateLensEditorRange(draft, ranges));

	let acknowledgedSignature = $state<string | null>(null);

	// Signature of the fields that affect the range warning. Editing any of
	// them invalidates a previously acknowledged warning (derived, no effect).
	const draftSignature = $derived(
		JSON.stringify([
			draft.lensCatalogItemId,
			draft.unitPrice,
			draft.quantity,
			draft.discount,
			draft.discountType,
			draft.od,
			draft.oi
		])
	);
	const confirmingRange = $derived(
		acknowledgedSignature !== null && acknowledgedSignature === draftSignature
	);

	function eyeEnabled(eye: 'OD' | 'OI'): boolean {
		return eye === 'OD' ? draft.od.enabled : draft.oi.enabled;
	}

	function eyeResult(eye: 'OD' | 'OI') {
		return rangeEvaluation.eyes.find((result) => result.eye === eye);
	}

	function eyeHasValues(eye: 'OD' | 'OI'): boolean {
		const result = eyeResult(eye);
		return (
			!!result && (result.sphere !== null || result.cylinder !== null || result.addition !== null)
		);
	}

	function eyeLabel(eye: 'OD' | 'OI'): string {
		if (!eyeEnabled(eye)) return 'No aplica';
		if (!eyeHasValues(eye)) return 'Sin receta';
		const status = eyeResult(eye)?.status ?? 'lab-review';
		if (status === 'in-range') return 'En rango';
		if (status === 'out-of-range') return 'Revisar rango';
		return 'Consultar laboratorio';
	}

	function eyeColor(eye: 'OD' | 'OI'): string {
		if (!eyeEnabled(eye)) return 'text-slate-400';
		if (!eyeHasValues(eye)) return 'text-slate-500';
		const status = eyeResult(eye)?.status ?? 'lab-review';
		if (status === 'in-range') return 'text-emerald-600';
		if (status === 'out-of-range') return 'text-amber-600';
		return 'text-slate-500';
	}

	function handleApply() {
		if (hasErrors) return;
		if (rangeEvaluation.warnings.length > 0 && !confirmingRange) {
			acknowledgedSignature = draftSignature;
			return;
		}
		acknowledgedSignature = null;
		onApply();
	}

	function cancelConfirm() {
		acknowledgedSignature = null;
	}

	function handleAddTreatment(event: Event) {
		const select = event.target as HTMLSelectElement;
		if (!select.value) return;
		onAddTreatment(select.value);
		select.value = '';
	}
</script>

<div
	class="rounded-xl border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-800 dark:bg-slate-800"
>
	<div class="mb-4 flex items-center justify-between gap-2">
		<div>
			<p class="text-sm font-bold text-sky-900 dark:text-sky-200">
				{mode === 'edit' ? 'Editar cristal' : 'Agregar cristal'}
			</p>
			<p class="text-[11px] text-slate-500 dark:text-slate-400">
				Configura el cristal, la receta y los tratamientos antes de aplicarlo.
			</p>
		</div>
	</div>

	<div class="space-y-4">
		<!-- ── Cristal + precio ── -->
		<section
			class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-600 dark:bg-slate-900/30"
		>
			<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
				Cristal y precio
			</p>
			{@render lensSelector()}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div>
					<label
						for="lens-quantity"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Cant.</label
					>
					<input
						id="lens-quantity"
						type="number"
						bind:value={draft.quantity}
						min="1"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:bg-slate-700 dark:text-white {errors.quantity
							? 'border-red-400'
							: 'border-slate-300 dark:border-slate-600'}"
					/>
					{#if errors.quantity}<p class="mt-1 text-[11px] text-red-600">{errors.quantity}</p>{/if}
				</div>
				<div>
					<label
						for="lens-price"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Precio</label
					>
					<input
						id="lens-price"
						type="number"
						bind:value={draft.unitPrice}
						min="0"
						step="0.01"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:bg-slate-700 dark:text-white {errors.unitPrice
							? 'border-red-400'
							: 'border-slate-300 dark:border-slate-600'}"
					/>
					{#if errors.unitPrice}<p class="mt-1 text-[11px] text-red-600">{errors.unitPrice}</p>{/if}
				</div>
				<div>
					<label
						for="lens-discount"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Desc.</label
					>
					<input
						id="lens-discount"
						type="number"
						bind:value={draft.discount}
						min="0"
						step="0.01"
						class="w-full rounded-lg border px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:bg-slate-700 dark:text-white {errors.discount
							? 'border-red-400'
							: 'border-slate-300 dark:border-slate-600'}"
					/>
					{#if errors.discount}<p class="mt-1 text-[11px] text-red-600">{errors.discount}</p>{/if}
				</div>
				<div>
					<label
						for="lens-discount-type"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase"
						>Tipo desc.</label
					>
					<select
						id="lens-discount-type"
						bind:value={draft.discountType}
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
					>
						<option value={DiscountType.FIXED}>$</option>
						<option value={DiscountType.PERCENTAGE}>%</option>
					</select>
				</div>
			</div>
			{#if errors.lensCatalogItemId}
				<p class="text-[11px] text-red-600">{errors.lensCatalogItemId}</p>
			{/if}
		</section>

		<!-- ── Receta ── -->
		<section class="space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
					Receta Óptica
				</p>
				{#if errors.prescription}
					<p class="text-[11px] font-medium text-red-600">{errors.prescription}</p>
				{/if}
			</div>

			<div class="grid gap-3 lg:grid-cols-2">
				<LensEyeFields
					title="OD (Ojo Derecho)"
					bind:eye={draft.od}
					prefix="od"
					{showAddition}
					statusLabel={eyeLabel('OD')}
					statusClass={eyeColor('OD')}
					{errors}
				/>
				<LensEyeFields
					title="OI (Ojo Izquierdo)"
					bind:eye={draft.oi}
					prefix="os"
					{showAddition}
					statusLabel={eyeLabel('OI')}
					statusClass={eyeColor('OI')}
					{errors}
				/>
			</div>
		</section>

		<!-- ── Advertencia de rango (no bloquea) ── -->
		{#if rangeEvaluation.warnings.length > 0}
			<div
				class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/30"
			>
				<p
					class="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
				>
					<TriangleAlert class="h-3.5 w-3.5" /> Fuera del rango óptico del cristal
				</p>
				<ul class="mt-1 list-inside list-disc text-[11px] text-amber-700 dark:text-amber-400">
					{#each rangeEvaluation.warnings as warning (warning)}
						<li>{warning}</li>
					{/each}
				</ul>
				<p class="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
					Es una advertencia: puedes continuar si el laboratorio ya confirmó estos valores.
				</p>
			</div>
		{/if}

		<!-- ── Tratamientos ── -->
		<section
			class="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-600 dark:bg-slate-900/30"
		>
			<div class="mb-2 flex items-center justify-between gap-2">
				<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
					Tratamientos ({draft.treatments.length})
				</p>
				<select
					value=""
					disabled={selectableTreatments.length === 0}
					onchange={handleAddTreatment}
					class="w-52 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
				>
					<option value="" disabled
						>{selectableTreatments.length === 0
							? 'No hay más disponibles'
							: 'Agregar tratamiento...'}</option
					>
					{#each selectableTreatments as treatment (treatment.id)}
						<option value={treatment.id}
							>{treatment.name} — {formatPrice(treatment.salePrice ?? treatment.price)} / ojo</option
						>
					{/each}
				</select>
			</div>
			{#if draft.treatments.length === 0}
				<p class="text-xs text-slate-400 italic">Sin tratamientos seleccionados</p>
			{:else}
				<div class="space-y-1">
					{#each draft.treatments as treatment, idx (treatment.supplierTreatmentId + idx)}
						<div
							class="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-700"
						>
							<FlaskConical class="h-3.5 w-3.5 shrink-0 text-purple-600" />
							<span class="flex-1 font-medium text-slate-800 dark:text-slate-200"
								>{treatment.name}</span
							>
							<span class="font-mono text-slate-600 dark:text-slate-400"
								>{formatPrice(treatment.salePrice * 2)}</span
							>
							<button
								type="button"
								onclick={() => onRemoveTreatment(idx)}
								class="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
					<p class="text-right text-[11px] text-slate-500 dark:text-slate-400">
						Tratamientos: {formatPrice(treatmentTotal(draft.treatments))}
					</p>
				</div>
			{/if}
		</section>

		<!-- ── Confirmación de rango o acciones ── -->
		{#if confirmingRange}
			<div
				class="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-900/30"
			>
				<p class="text-xs text-amber-800 dark:text-amber-300">
					Hay valores fuera del rango del cristal. ¿Aplicar de todos modos?
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={cancelConfirm}
						class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
						>Volver a editar</button
					>
					<button
						type="button"
						onclick={handleApply}
						class="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
					>
						<Check class="h-3.5 w-3.5" /> Aplicar de todos modos
					</button>
				</div>
			</div>
		{:else}
			<div class="flex justify-end gap-2 pt-1">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
					>Cancelar</button
				>
				<button
					type="button"
					onclick={handleApply}
					aria-disabled={hasErrors}
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
				>
					<Save class="h-3.5 w-3.5" />{mode === 'edit' ? 'Aplicar cambios' : 'Agregar cristal'}
				</button>
			</div>
		{/if}
	</div>
</div>
