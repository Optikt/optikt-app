<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Check, Copy, TriangleAlert, X } from '@lucide/svelte';
	import { LensType } from '$lib/shared/enums/lensTypes';

	import {
		evaluateLensEditorRange,
		hasLensEditorErrors,
		validateLensEditorDraft
	} from './lensEditor';
	import LensEyeFields from './LensEyeFields.svelte';
	import PriceQtyFields from '$lib/components/commercialDocument/PriceQtyFields.svelte';
	import type { LensEditorDraft } from './types';
	import type { OpticalRangeBounds } from './opticalRange';

	interface Props {
		mode: 'add' | 'edit';
		/** Hide the «Editando cristal / Hecho» row when a shell owns the band. */
		showHeader?: boolean;
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
	}

	let {
		mode,
		showHeader = true,
		draft = $bindable(),
		lensType,
		ranges,
		selectableTreatments,
		lensSelector,
		onAddTreatment,
		onRemoveTreatment,
		onApply
	}: Props = $props();

	const showAddition = $derived(lensType !== '' && lensType !== LensType.MONOFOCAL);
	const errors = $derived(validateLensEditorDraft(draft, { requiresAddition: showAddition }));
	const hasErrors = $derived(hasLensEditorErrors(errors));
	const rangeEvaluation = $derived(evaluateLensEditorRange(draft, ranges));
	const fieldErrors = $derived(
		[errors.unitPrice, errors.quantity, errors.discount].filter((message): message is string =>
			Boolean(message)
		)
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
		if (status === 'out-of-range') return 'Revisar';
		return 'Consultar';
	}

	function eyeColor(eye: 'OD' | 'OI'): string {
		if (!eyeEnabled(eye)) return 'text-slate-400';
		if (!eyeHasValues(eye)) return 'text-slate-400';
		const status = eyeResult(eye)?.status ?? 'lab-review';
		if (status === 'in-range') return 'text-emerald-600 dark:text-emerald-400';
		if (status === 'out-of-range') return 'text-amber-600 dark:text-amber-400';
		return 'text-slate-400';
	}

	function copyOdToOi() {
		draft.oi = { ...draft.od };
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
		if (rangeEvaluation.warnings.length > 0 && !confirmingRange) {
			acknowledgedSignature = draftSignature;
			return;
		}
		acknowledgedSignature = null;
		onApply();
	}
</script>

{#if showHeader}<div class="mb-2.5 flex items-center justify-between gap-2">
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
	</div>{/if}

<div class="flex flex-wrap items-end gap-2.5">
	<div class="min-w-[220px] flex-[2]">
		<span
			class="mb-1 block text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>Cristal</span
		>
		{@render lensSelector()}
		{#if errors.lensCatalogItemId}
			<p class="mt-1 text-[10.5px] text-red-600 dark:text-red-400">{errors.lensCatalogItemId}</p>
		{/if}
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
	<p class="mt-1 text-[10.5px] text-red-600 dark:text-red-400">{fieldErrors.join(' · ')}</p>
{/if}

<div class="mt-3.5 border-t border-dashed border-outline-variant/70 pt-3 dark:border-slate-600">
	<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
		<span
			class="text-[10.5px] font-extrabold tracking-[0.09em] text-slate-400 uppercase dark:text-slate-500"
			>Receta</span
		>
		<div class="flex items-center gap-2">
			{#if errors.prescription}
				<p class="text-[10.5px] font-medium text-red-600 dark:text-red-400">
					{errors.prescription}
				</p>
			{/if}
			<button
				type="button"
				class="inline-flex items-center gap-1 text-[10.5px] font-bold text-brand-blue-dark transition hover:text-brand-navy dark:text-brand-blue-light dark:hover:text-white"
				onclick={copyOdToOi}
			>
				<Copy class="h-3 w-3" /> Copiar OD → OI
			</button>
		</div>
	</div>

	<div class="grid gap-3 md:grid-cols-2">
		<LensEyeFields
			bind:eye={draft.od}
			prefix="od"
			{showAddition}
			statusLabel={eyeLabel('OD')}
			statusClass={eyeColor('OD')}
			{errors}
		/>
		<LensEyeFields
			bind:eye={draft.oi}
			prefix="os"
			{showAddition}
			statusLabel={eyeLabel('OI')}
			statusClass={eyeColor('OI')}
			{errors}
		/>
	</div>

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
			</button>
		{:else}
			<span class="text-[11.5px] text-slate-400 dark:text-slate-500">
				Sin tratamientos disponibles para este cristal
			</span>
		{/each}
	</div>
</div>

{#if rangeEvaluation.warnings.length > 0}
	<div
		class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/30"
	>
		<p class="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
			<TriangleAlert class="h-3.5 w-3.5" /> Fuera del rango óptico del cristal
		</p>
		<ul class="mt-1 list-inside list-disc text-[10.5px] text-amber-700 dark:text-amber-400">
			{#each rangeEvaluation.warnings as warning (warning)}
				<li>{warning}</li>
			{/each}
		</ul>
	</div>
{/if}

{#if confirmingRange}
	<div
		class="mt-3 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-900/30"
	>
		<p class="text-[11px] text-amber-800 dark:text-amber-300">
			Hay valores fuera del rango. ¿Aplicar de todos modos?
		</p>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => (acknowledgedSignature = null)}
				class="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700"
				>Volver a editar</button
			>
			<button
				type="button"
				onclick={handleApply}
				class="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
			>
				<Check class="h-3 w-3" /> Aplicar igual
			</button>
		</div>
	</div>
{/if}
