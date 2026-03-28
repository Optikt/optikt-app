<script lang="ts">
	import { Input, Label, Select } from 'flowbite-svelte';
	import { Eye, Copy } from '@lucide/svelte';
	import { LensType, ALL_LENS_TYPES, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import type { Prescription } from '$lib/server/db/schema';

	/**
	 * Prescription values managed by this component.
	 * All values are strings to match form input behavior.
	 */
	export interface PrescriptionValues {
		odSphere: string;
		odCylinder: string;
		odAxis: string;
		odAddition: string;
		oiSphere: string;
		oiCylinder: string;
		oiAxis: string;
		oiAddition: string;
		lensType: string;
	}

	import type { PrescriptionFieldErrors } from './saleItemHelpers';

	interface Props {
		/** Bindable prescription values */
		values: PrescriptionValues;
		/** Optional existing prescription to auto-fill from */
		existingPrescription?: Prescription | null;
		/** Whether addition fields are visible (non-monofocal) — reserved for future use */
		showAddition?: boolean;
		/** Compact mode for inline use — reserved for future use */
		compact?: boolean;
		/** Per-field validation errors */
		errors?: PrescriptionFieldErrors;
	}

	let {
		values = $bindable(),
		existingPrescription = null,
		showAddition: _showAddition = false,
		compact: _compact = false,
		errors = {}
	}: Props = $props();

	// Track whether user has been offered autofill
	let autofillDismissed = $state(false);
	let autofillApplied = $state(false);

	const canAutofill = $derived(
		existingPrescription !== null && !autofillDismissed && !autofillApplied
	);

	const isMonofocal = $derived(values.lensType === LensType.MONOFOCAL);

	// Clear addition when switching to monofocal
	$effect(() => {
		if (isMonofocal) {
			values.odAddition = '';
			values.oiAddition = '';
		}
	});

	function applyAutofill() {
		if (!existingPrescription) return;
		values.odSphere = existingPrescription.odSphere?.toString() ?? '';
		values.odCylinder = existingPrescription.odCylinder?.toString() ?? '';
		values.odAxis = existingPrescription.odAxis?.toString() ?? '';
		values.odAddition = existingPrescription.odAddition?.toString() ?? '';
		values.oiSphere = existingPrescription.osSphere?.toString() ?? '';
		values.oiCylinder = existingPrescription.osCylinder?.toString() ?? '';
		values.oiAxis = existingPrescription.osAxis?.toString() ?? '';
		values.oiAddition = existingPrescription.osAddition?.toString() ?? '';
		if (existingPrescription.recommendedLensType) {
			values.lensType = existingPrescription.recommendedLensType;
		}
		autofillApplied = true;
	}

	function dismissAutofill() {
		autofillDismissed = true;
	}

	const lensTypeOptions = ALL_LENS_TYPES.map((type) => ({
		value: type,
		name: getLensTypeLabel(type)
	}));

	function formatOpt(v: number | null | undefined): string {
		if (v == null) return '—';
		return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
	}
</script>

<div class="space-y-3">
	<!-- Autofill banner -->
	{#if canAutofill}
		<div
			class="flex items-center gap-3 rounded-lg border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3"
		>
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
				<Eye class="h-4 w-4 text-white" />
			</div>
			<div class="flex-1">
				<p class="text-sm font-bold text-emerald-800">¡Fórmula encontrada para este paciente!</p>
				<p class="mt-0.5 text-xs text-emerald-600">
					<span class="font-mono font-semibold">
						OD {formatOpt(existingPrescription?.odSphere)} / {formatOpt(
							existingPrescription?.odCylinder
						)}
					</span>
					<span class="mx-1.5 text-emerald-400">·</span>
					<span class="font-mono font-semibold">
						OI {formatOpt(existingPrescription?.osSphere)} / {formatOpt(
							existingPrescription?.osCylinder
						)}
					</span>
				</p>
			</div>
			<button
				class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
				onclick={applyAutofill}
			>
				Usar fórmula
			</button>
			<button
				class="rounded-lg px-3 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-100"
				onclick={dismissAutofill}
			>
				Ignorar
			</button>
		</div>
	{/if}

	<!-- Lens type selector + Copy OD → OI -->
	<div class="flex items-center gap-3">
		<Label class="shrink-0 text-sm font-semibold text-slate-700">Tipo de lente</Label>
		<Select bind:value={values.lensType} class="w-44">
			{#each lensTypeOptions as opt (opt.value)}
				<option value={opt.value}>{opt.name}</option>
			{/each}
		</Select>
		<button
			type="button"
			class="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
			onclick={() => {
				values.oiSphere = values.odSphere;
				values.oiCylinder = values.odCylinder;
				values.oiAxis = values.odAxis;
				values.oiAddition = values.odAddition;
			}}
		>
			<Copy class="h-3 w-3" />
			Copiar OD → OI
		</button>
	</div>

	<!-- Eye values -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- Right Eye (OD) -->
		<div class="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 p-3">
			<div class="mb-2 flex items-center gap-2">
				<div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
					<Eye class="h-3 w-3 text-white" />
				</div>
				<h5 class="text-sm font-bold text-blue-800">OD — Ojo Derecho</h5>
			</div>
			<div class="grid grid-cols-2 gap-2 {!isMonofocal ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}">
				<div>
					<Label class="mb-0.5 text-xs text-slate-500">Esfera</Label>
					<Input
						type="number"
						step={0.25}
						placeholder="-2.00"
						bind:value={values.odSphere}
						class="font-mono text-sm {errors?.odSphere ? '!border-red-400' : ''}"
					/>
					{#if errors?.odSphere}
						<p class="mt-0.5 text-xs text-red-500">{errors.odSphere}</p>
					{/if}
				</div>
				<div>
					<Label class="mb-0.5 text-xs text-slate-500">Cilindro</Label>
					<Input
						type="number"
						step={0.25}
						min={-10}
						max={0}
						placeholder="-0.50"
						bind:value={values.odCylinder}
						class="font-mono text-sm {errors?.odCylinder ? '!border-red-400' : ''}"
					/>
					{#if errors?.odCylinder}
						<p class="mt-0.5 text-xs text-red-500">{errors.odCylinder}</p>
					{/if}
				</div>
				<div>
					<Label class="mb-0.5 text-xs text-slate-500">Eje</Label>
					<Input
						type="number"
						step={1}
						min={0}
						max={180}
						placeholder="180"
						bind:value={values.odAxis}
						class="font-mono text-sm {errors?.odAxis ? '!border-red-400' : ''}"
					/>
					{#if errors?.odAxis}
						<p class="mt-0.5 text-xs text-red-500">{errors.odAxis}</p>
					{/if}
				</div>
				{#if !isMonofocal}
					<div>
						<Label class="mb-0.5 text-xs text-slate-500">Adición</Label>
						<Input
							type="number"
							step={0.25}
							min={0}
							max={5}
							placeholder="+1.50"
							bind:value={values.odAddition}
							class="font-mono text-sm {errors?.odAddition ? '!border-red-400' : ''}"
						/>
						{#if errors?.odAddition}
							<p class="mt-0.5 text-xs text-red-500">{errors.odAddition}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Left Eye (OI) -->
		<div
			class="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-violet-50/50 p-3"
		>
			<div class="mb-2 flex items-center gap-2">
				<div class="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500">
					<Eye class="h-3 w-3 text-white" />
				</div>
				<h5 class="text-sm font-bold text-violet-800">OI — Ojo Izquierdo</h5>
			</div>
			<div class="grid grid-cols-2 gap-2 {!isMonofocal ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}">
				<div>
					<Label class="mb-0.5 text-xs text-slate-500">Esfera</Label>
					<Input
						type="number"
						step={0.25}
						placeholder="-2.00"
						bind:value={values.oiSphere}
						class="font-mono text-sm {errors?.oiSphere ? '!border-red-400' : ''}"
					/>
					{#if errors?.oiSphere}
						<p class="mt-0.5 text-xs text-red-500">{errors.oiSphere}</p>
					{/if}
				</div>
				<div>
					<Label class="mb-0.5 text-xs text-slate-500">Cilindro</Label>
					<Input
						type="number"
						step={0.25}
						min={-10}
						max={0}
						placeholder="-0.50"
						bind:value={values.oiCylinder}
						class="font-mono text-sm {errors?.oiCylinder ? '!border-red-400' : ''}"
					/>
					{#if errors?.oiCylinder}
						<p class="mt-0.5 text-xs text-red-500">{errors.oiCylinder}</p>
					{/if}
				</div>
				<div>
					<Label class="mb-0.5 text-xs text-slate-500">Eje</Label>
					<Input
						type="number"
						step={1}
						min={0}
						max={180}
						placeholder="180"
						bind:value={values.oiAxis}
						class="font-mono text-sm {errors?.oiAxis ? '!border-red-400' : ''}"
					/>
					{#if errors?.oiAxis}
						<p class="mt-0.5 text-xs text-red-500">{errors.oiAxis}</p>
					{/if}
				</div>
				{#if !isMonofocal}
					<div>
						<Label class="mb-0.5 text-xs text-slate-500">Adición</Label>
						<Input
							type="number"
							step={0.25}
							min={0}
							max={5}
							placeholder="+1.50"
							bind:value={values.oiAddition}
							class="font-mono text-sm {errors?.oiAddition ? '!border-red-400' : ''}"
						/>
						{#if errors?.oiAddition}
							<p class="mt-0.5 text-xs text-red-500">{errors.oiAddition}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
