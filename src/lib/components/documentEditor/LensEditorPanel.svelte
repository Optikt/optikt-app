<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Check, TriangleAlert, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import { LensType } from '$lib/shared/enums/lensTypes';

	import {
		evaluateLensEditorRange,
		hasLensEditorErrors,
		eyesWithRxPair,
		missingSoftMeasures,
		validateLensEditorDraft
	} from './lensEditor';
	import LensRxGrid from './LensRxGrid.svelte';
	import PriceQtyFields from '$lib/components/commercialDocument/PriceQtyFields.svelte';
	import type { LensEditorDraft } from './types';
	import type { OpticalRangeBounds } from './opticalRange';

	interface SupplierTreatmentOption {
		id: string;
		name: string;
		/** Coste por ojo (usado como base). */
		price: number;
		salePrice?: number | null;
		category: string;
	}

	interface Props {
		mode: 'add' | 'edit';
		draft: LensEditorDraft;
		/** Lens type of the selected catalog item (drives addition/height inputs). */
		lensType: string;
		ranges: OpticalRangeBounds[];
		selectableTreatments: SupplierTreatmentOption[];
		/** Tratamientos incluidos de fábrica (informativos, sin precio). */
		factoryTreatments?: string[];
		/** Origen del cristal: copia del tooltip «De fábrica». */
		factorySource?: 'tallado' | 'terminado' | null;
		/** Laboratorio del cristal (título del bloque de antirreflejo). */
		supplierName?: string | null;
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
		factoryTreatments = [],
		factorySource = null,
		supplierName = null,
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

	const eyes = $derived(eyesWithRxPair(draft.od, draft.oi));

	/** Antirreflejo choices: current selections + types the lab offers. */
	const arOptions = $derived.by(() => {
		const chosen = draft.treatments
			.filter((treatment) => treatment.category.toUpperCase() === 'AR')
			.map((treatment) => ({
				id: treatment.supplierTreatmentId,
				name: treatment.name,
				price: treatment.price,
				salePrice: treatment.salePrice,
				selected: true
			}));
		const selectable = selectableTreatments
			.filter((treatment) => treatment.category.toUpperCase() === 'AR')
			.map((treatment) => ({
				id: treatment.id,
				name: treatment.name,
				price: treatment.price,
				salePrice: treatment.salePrice ?? treatment.price,
				selected: false
			}));
		return [...chosen, ...selectable];
	});

	const additionalOptions = $derived.by(() => {
		const chosen = draft.treatments
			.filter((treatment) => treatment.category.toUpperCase() !== 'AR')
			.map((treatment) => ({ ...treatment, selected: true }));
		const selectable = selectableTreatments
			.filter((treatment) => treatment.category.toUpperCase() !== 'AR')
			.map((treatment) => ({
				supplierTreatmentId: treatment.id,
				name: treatment.name,
				price: treatment.price,
				salePrice: treatment.salePrice ?? treatment.price,
				isTaxable: true,
				category: treatment.category,
				selected: false
			}));
		return [...chosen, ...selectable];
	});

	/** Antirreflejo adicional solo para tallado sin AR de fábrica. */
	const showArBlock = $derived(
		factorySource === 'tallado' && !factoryHasAr() && arOptions.length > 0
	);

	function factoryHasAr(): boolean {
		return factoryTreatments.some((name) => name.toLowerCase().includes('antirreflejo'));
	}

	const treatmentsTotal = $derived(
		draft.treatments.reduce((sum, treatment) => sum + treatment.salePrice * eyes, 0)
	);

	function hasArSelected(): boolean {
		return draft.treatments.some((treatment) => treatment.category.toUpperCase() === 'AR');
	}

	function removeArSelection() {
		const victim = draft.treatments.findIndex(
			(treatment) => treatment.category.toUpperCase() === 'AR'
		);
		if (victim >= 0) onRemoveTreatment(victim);
	}

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

	/** Antirreflejo: radio (una sola elección). Al elegir reemplaza la previa. */
	function pickAr(id: string, selected: boolean) {
		if (selected) {
			removeArSelection();
			return;
		}
		removeArSelection();
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

	<!-- Tratamientos: fábrica + AR del laboratorio + adicionales (§8.6) -->
	<div class="mt-3 border-t border-outline-variant/70 pt-3">
		<div class="mb-2 flex items-center justify-between">
			<span
				class="text-[10.5px] font-bold tracking-[0.05em] text-slate-400 uppercase dark:text-slate-500"
			>
				Tratamientos
			</span>
			{#if treatmentsTotal > 0}
				<span
					class="tabular rounded-[4px] bg-info-container px-2 py-0.5 text-[11px] font-bold text-on-info-container"
				>
					+{formatPrice(treatmentsTotal)} · {eyes}
					{eyes === 1 ? 'ojo' : 'ojos'}
				</span>
			{/if}
		</div>

		{#if factoryTreatments.length > 0}
			{#snippet factoryLabel({ props }: { props: Record<string, unknown> })}
				<span
					{...props}
					class="cursor-help text-[12px] leading-6 font-semibold text-on-surface-variant underline decoration-dotted"
				>
					De fábrica
				</span>
			{/snippet}
			<div class="mb-2 flex flex-wrap items-center gap-2">
				<TriggerTooltip
					text={factorySource === 'terminado'
						? 'Cristal terminado: sus tratamientos vienen de fábrica y no se pueden modificar.'
						: 'Incluidos de fábrica en este cristal; no se pueden quitar. Abajo puedes agregar los adicionales del laboratorio.'}
					trigger={factoryLabel}
				/>
				{#each factoryTreatments as factory (factory)}
					<span
						class="inline-flex items-center gap-1 rounded-md bg-surface-container-high px-2 py-0.5 text-[12px] font-semibold text-on-surface-variant"
					>
						<Check class="h-3 w-3" />
						{factory}
					</span>
				{/each}
			</div>
		{/if}

		{#if showArBlock}
			<div class="mb-2">
				<p class="mb-1.5 text-[12px] leading-6 font-semibold text-on-surface-variant">
					Antirreflejo adicional · {supplierName ?? 'Laboratorio'}
					<span class="font-normal">(cristal tallado)</span>
				</p>
				<div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
					<button
						type="button"
						aria-pressed={!hasArSelected()}
						onclick={() => removeArSelection()}
						class={`rounded-[10px] border px-3 py-2 text-left transition hover:border-brand-blue ${hasArSelected() ? 'border-outline-variant bg-white' : 'border-brand-blue bg-info-container ring-1 ring-brand-blue'}`}
					>
						<span class="block text-[13px] font-semibold text-on-surface">Ninguno</span>
						<span class="block text-[12px] text-on-surface-variant">Sin antirreflejo extra</span>
					</button>
					{#each arOptions as ar (ar.id)}
						<button
							type="button"
							aria-pressed={ar.selected}
							onclick={() => pickAr(ar.id, ar.selected)}
							class={`rounded-[10px] border px-3 py-2 text-left transition hover:border-brand-blue ${
								ar.selected
									? 'border-brand-blue bg-info-container ring-1 ring-brand-blue'
									: 'border-outline-variant bg-white'
							}`}
						>
							<span class="block text-[13px] font-semibold text-on-surface">{ar.name}</span>
							<span
								class="block text-[12px] {ar.selected
									? 'text-on-info-container'
									: 'text-on-surface-variant'}"
							>
								{'USD ' + (ar.salePrice ?? ar.price).toFixed(2)} por ojo
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if additionalOptions.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each additionalOptions as extra (extra.supplierTreatmentId)}
					<button
						type="button"
						onclick={() => toggleTreatment(extra.supplierTreatmentId, extra.selected)}
						aria-pressed={extra.selected}
						class="rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition {extra.selected
							? 'border-outline-variant bg-info-container text-on-info-container'
							: 'border-outline-variant bg-white text-slate-600 hover:border-brand-blue/60'}"
					>
						{#if extra.selected}
							<X class="mr-0.5 inline h-3 w-3" />
						{:else}
							<span class="text-[10px] opacity-60">+</span>
						{/if}
						{extra.name}
						<span class="text-[10px] opacity-70"
							>+USD {(extra.salePrice ?? extra.price).toFixed(2)}/ojo</span
						>
					</button>
				{/each}
			</div>
		{:else if factoryTreatments.length === 0 && !showArBlock}
			{#snippet noTreatments({ props }: { props: Record<string, unknown> })}
				<span
					{...props}
					class="inline-flex cursor-help items-center rounded-md bg-surface-container-high px-2 py-0.5 text-[12px] font-semibold text-on-surface-variant"
				>
					Sin tratamientos
				</span>
			{/snippet}
			<TriggerTooltip
				text="Este cristal no admite tratamientos adicionales"
				trigger={noTreatments}
			/>
		{/if}
	</div>
</div>
