<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TriangleAlert, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { LensType } from '$lib/shared/enums/lensTypes';

	import {
		evaluateLensEditorRange,
		hasLensEditorErrors,
		missingSoftMeasures,
		validateLensEditorDraft
	} from './lensEditor';
	import LensRxGrid from './LensRxGrid.svelte';
	import PriceQtyFields from '$lib/components/commercialDocument/PriceQtyFields.svelte';
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
		/** Hide the «Editando cristal / Hecho» row when a shell owns the band. */
		showHeader?: boolean;
		onAddTreatment: (id: string) => void;
		onRemoveTreatment: (idx: number) => void;
		onApply: () => void;
	}

	let {
		mode,
		draft = $bindable(),
		lensType,
		ranges,
		selectableTreatments,
		lensSelector,
		showHeader = true,
		onAddTreatment,
		onRemoveTreatment,
		onApply
	}: Props = $props();

	const showAddition = $derived(lensType !== '' && lensType !== LensType.MONOFOCAL);
	const errors = $derived(validateLensEditorDraft(draft, { requiresAddition: showAddition }));
	const hasErrors = $derived(hasLensEditorErrors(errors));
	const rangeEvaluation = $derived(evaluateLensEditorRange(draft, ranges));
	const fieldErrors = $derived(
		[
			errors.lensCatalogItemId,
			errors.unitPrice,
			errors.quantity,
			errors.discount,
			errors.prescription
		].filter((message): message is string => Boolean(message))
	);

	const treatmentOptions = $derived([
		...draft.treatments.map((treatment) => ({
			id: treatment.supplierTreatmentId,
			name: treatment.name,
			price: treatment.salePrice,
			selected: true
		})),
		...selectableTreatments.map((treatment) => ({
			id: treatment.id,
			name: treatment.name,
			price: treatment.salePrice ?? treatment.price,
			selected: false
		}))
	]);

	let acknowledgedSignature = $state<string | null>(null);

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

	// Per-eye status icon (GRADUACIÓN header): text lives in a tooltip.
	const status = $derived.by(() => {
		const ranges: Record<'od' | 'oi', { tone: 'ok' | 'w' | 'n'; label: string }> = {
			od: { label: 'Sin receta', tone: 'n' },
			oi: { label: 'Sin receta', tone: 'n' }
		};
		for (const key of ['od', 'oi'] as const) {
			if (!draft[key].enabled) continue;
			const hasGraduation = draft[key].sphere != null || draft[key].cylinder != null;
			if (!hasGraduation) {
				ranges[key] = { label: 'Incompleto', tone: 'n' };
				continue;
			}
			if (missingSoftMeasures(draft[key], showAddition)) {
				ranges[key] = { label: 'Faltan medidas', tone: 'w' };
				continue;
			}
			const result = rangeEvaluation.eyes.find((eyeResult) => eyeResult.eye === key.toUpperCase());
			if (result?.status === 'out-of-range') {
				ranges[key] = { label: 'Revisar', tone: 'w' };
				continue;
			}
			ranges[key] = { label: 'En rango', tone: 'ok' };
		}
		return ranges;
	});

	const outOfRangeEyes = $derived.by(() => {
		const lines: { eye: 'OD' | 'OI'; detail: string }[] = [];
		for (const result of rangeEvaluation.eyes) {
			if (result.status !== 'out-of-range') continue;
			if (result.eye === 'OD' ? !draft.od.enabled : !draft.oi.enabled) continue;
			lines.push({ eye: result.eye, detail: result.prescriptionSummary });
		}
		return lines;
	});

	function copyOdToOi() {
		draft.oi = { ...draft.od };
		toast.success('Graduación copiada al OI');
	}

	function toggleTreatment(id: string, selected: boolean) {
		if (selected) {
			const index = draft.treatments.findIndex((item) => item.supplierTreatmentId === id);
			if (index >= 0) onRemoveTreatment(index);
			return;
		}
		onAddTreatment(id);
	}

	function handleApply() {
		if (hasErrors) return;
		if (outOfRangeEyes.length > 0 && !confirmingRange) {
			acknowledgedSignature = draftSignature;
			return;
		}
		acknowledgedSignature = null;
		onApply();
	}
</script>

{#if showHeader}
	<div class="mb-2.5 flex items-center justify-between gap-2">
		<span
			class="text-[10.5px] font-extrabold tracking-[0.09em] text-brand-blue-dark uppercase dark:text-brand-blue-light"
		>
			{mode === 'edit' ? 'Editando cristal' : 'Nuevo cristal'}
		</span>
		<button
			type="button"
			onclick={handleApply}
			aria-disabled={hasErrors}
			class="h-[26px] rounded-[7px] bg-brand-blue/10 px-3 text-xs font-bold text-brand-blue-dark transition hover:bg-brand-blue/15 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 dark:bg-brand-blue/20 dark:text-brand-blue-light"
		>
			Hecho ✓
		</button>
	</div>
{/if}

<div class="flex flex-wrap items-end gap-2.5">
	<div class="min-w-[220px] flex-[2]">
		<span
			class="mb-1 block text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>Cristal</span
		>
		{@render lensSelector()}
	</div>

	<PriceQtyFields
		unitPrice={draft.unitPrice}
		quantity={draft.quantity}
		discount={draft.discount}
		discountType={draft.discountType}
		onPrice={(value) => (draft.unitPrice = value)}
		onQty={(value) => (draft.quantity = value)}
		onDiscount={(value) => (draft.discount = value)}
		onDiscountType={(value) => (draft.discountType = value)}
	/>
</div>

{#if fieldErrors.length > 0}
	<p class="mt-1 text-[12px] text-error" role="alert">{fieldErrors.join(' · ')}</p>
{/if}

<!-- Receta: GRADUACIÓN + MEDIDAS side-by-side (folds at small widths) -->
<div class="px-2 py-3.5">
	<LensRxGrid
		bind:od={draft.od}
		bind:oi={draft.oi}
		requiresAddition={showAddition}
		{status}
		onCopy={copyOdToOi}
	/>

	{#if outOfRangeEyes.length > 0 && !confirmingRange}
		<div class="mt-3 rounded-lg border border-warning bg-warning-container px-3 py-2">
			<p class="flex items-center gap-1.5 text-[11px] font-bold text-on-warning-container">
				<TriangleAlert class="h-3.5 w-3.5" /> Fuera del rango óptico del cristal
			</p>
			{#each outOfRangeEyes as line (line.eye)}
				<p class="mt-1 text-[10.5px] text-on-warning-container">
					{line.eye} fuera de rango óptico · {line.detail}
				</p>
			{/each}
			<button
				type="button"
				onclick={() => (acknowledgedSignature = draftSignature)}
				class="mt-2 rounded-lg border border-on-warning-container/30 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-on-warning-container transition hover:bg-white"
			>
				Aplicar igual
			</button>
		</div>
	{/if}

	<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
		<span
			class="mr-1 text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>Tratamientos</span
		>
		{#each treatmentOptions as treatment (treatment.id)}
			<button
				type="button"
				onclick={() => toggleTreatment(treatment.id, treatment.selected)}
				aria-pressed={treatment.selected}
				class="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition {treatment.selected
					? 'border-brand-blue bg-brand-blue/10 text-brand-blue-dark'
					: 'border-outline-variant bg-white text-slate-600 hover:border-brand-blue/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}"
			>
				{#if treatment.selected}
					<X class="mr-0.5 inline h-3 w-3" />
				{:else}
					<span class="text-[10px] opacity-60">+</span>
				{/if}
				{treatment.name}
				<span class="text-[10px] opacity-70">+{(treatment.price ?? 0).toFixed(2)}/ojo</span>
			</button>
		{:else}
			<span class="text-[11.5px] text-slate-400 dark:text-slate-500">
				Sin tratamientos disponibles para este cristal
			</span>
		{/each}
	</div>
</div>
