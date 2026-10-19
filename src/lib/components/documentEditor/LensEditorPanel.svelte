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
	const errors = $derived(validateLensEditorDraft(draft));
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

	function eyeStatus(eye: 'OD' | 'OI'): string {
		return rangeEvaluation.eyes.find((result) => result.eye === eye)?.status ?? 'lab-review';
	}

	function statusLabel(status: string): string {
		if (status === 'in-range') return 'En rango';
		if (status === 'out-of-range') return 'Revisar rango';
		return 'Consultar laboratorio';
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

	function inputClass(invalid: boolean): string {
		const base =
			'w-full rounded-md border bg-white px-2 py-1.5 font-mono text-sm focus:ring-2 focus:outline-none dark:bg-slate-800 dark:text-white ';
		return invalid
			? base + 'border-red-400 focus:border-red-400 focus:ring-red-200'
			: base +
					'border-slate-300 focus:border-brand-blue focus:ring-brand-blue/20 dark:border-slate-600';
	}
</script>

<div
	class="mb-3 rounded-lg border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-slate-800"
>
	<p class="mb-3 text-xs font-bold text-sky-800 dark:text-sky-300">
		{mode === 'edit' ? 'Editar cristal' : 'Agregar cristal'}
	</p>

	<div class="space-y-4">
		<!-- ── Cristal + precio ── -->
		<div class="space-y-3">
			{@render lensSelector()}
			<div class="grid grid-cols-4 gap-3">
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
		</div>

		<!-- ── Receta ── -->
		<div class="space-y-3">
			<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Receta Óptica</p>

			<!-- OD -->
			<div class="space-y-1">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold text-slate-700 dark:text-slate-300"
						>OD (Ojo Derecho)</span
					>
					<span
						class="text-[11px] font-medium {eyeStatus('OD') === 'in-range'
							? 'text-emerald-600'
							: eyeStatus('OD') === 'out-of-range'
								? 'text-amber-600'
								: 'text-slate-400'}">{statusLabel(eyeStatus('OD'))}</span
					>
				</div>
				<div class={['grid gap-2', { 'grid-cols-5': showAddition, 'grid-cols-3': !showAddition }]}>
					<input
						type="number"
						step="0.25"
						placeholder="Esf"
						bind:value={draft.od.sphere}
						class={inputClass(!!errors.odSphere)}
					/>
					<input
						type="number"
						step="0.25"
						placeholder="Cil"
						bind:value={draft.od.cylinder}
						class={inputClass(!!errors.odCylinder)}
					/>
					<input
						type="number"
						step="1"
						placeholder="Eje"
						bind:value={draft.od.axis}
						class={inputClass(!!errors.odAxis)}
					/>
					{#if showAddition}
						<input
							type="number"
							step="0.25"
							placeholder="Add"
							bind:value={draft.od.addition}
							class={inputClass(!!errors.odAddition)}
						/>
						<input
							type="number"
							step="1"
							placeholder="Alt"
							bind:value={draft.od.altura}
							class={inputClass(!!errors.odAltura)}
						/>
					{/if}
				</div>
				{#if errors.odSphere || errors.odCylinder || errors.odAxis || errors.odAddition || errors.odAltura}
					<p class="text-[11px] text-red-600">
						{[errors.odSphere, errors.odCylinder, errors.odAxis, errors.odAddition, errors.odAltura]
							.filter(Boolean)
							.join(' · ')}
					</p>
				{/if}
			</div>

			<!-- OI -->
			<div class="space-y-1">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold text-slate-700 dark:text-slate-300"
						>OI (Ojo Izquierdo)</span
					>
					<span
						class="text-[11px] font-medium {eyeStatus('OI') === 'in-range'
							? 'text-emerald-600'
							: eyeStatus('OI') === 'out-of-range'
								? 'text-amber-600'
								: 'text-slate-400'}">{statusLabel(eyeStatus('OI'))}</span
					>
				</div>
				<div class={['grid gap-2', { 'grid-cols-5': showAddition, 'grid-cols-3': !showAddition }]}>
					<input
						type="number"
						step="0.25"
						placeholder="Esf"
						bind:value={draft.oi.sphere}
						class={inputClass(!!errors.osSphere)}
					/>
					<input
						type="number"
						step="0.25"
						placeholder="Cil"
						bind:value={draft.oi.cylinder}
						class={inputClass(!!errors.osCylinder)}
					/>
					<input
						type="number"
						step="1"
						placeholder="Eje"
						bind:value={draft.oi.axis}
						class={inputClass(!!errors.osAxis)}
					/>
					{#if showAddition}
						<input
							type="number"
							step="0.25"
							placeholder="Add"
							bind:value={draft.oi.addition}
							class={inputClass(!!errors.osAddition)}
						/>
						<input
							type="number"
							step="1"
							placeholder="Alt"
							bind:value={draft.oi.altura}
							class={inputClass(!!errors.osAltura)}
						/>
					{/if}
				</div>
				{#if errors.osSphere || errors.osCylinder || errors.osAxis || errors.osAddition || errors.osAltura}
					<p class="text-[11px] text-red-600">
						{[errors.osSphere, errors.osCylinder, errors.osAxis, errors.osAddition, errors.osAltura]
							.filter(Boolean)
							.join(' · ')}
					</p>
				{/if}
			</div>
		</div>

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
		<div>
			<div class="mb-2 flex items-center justify-between">
				<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
					Tratamientos ({draft.treatments.length})
				</p>
				<select
					value=""
					disabled={selectableTreatments.length === 0}
					onchange={handleAddTreatment}
					class="w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
		</div>

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
					class="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
				>
					<Save class="h-3.5 w-3.5" />{mode === 'edit' ? 'Aplicar cambios' : 'Agregar cristal'}
				</button>
			</div>
		{/if}
	</div>
</div>
