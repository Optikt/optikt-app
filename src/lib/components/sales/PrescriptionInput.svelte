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
		doctorName: string;
	}

	import type { PrescriptionFieldErrors } from './saleItemHelpers';

	interface Props {
		/** Bindable prescription values */
		values: PrescriptionValues;
		/** Optional existing prescription to auto-fill from */
		existingPrescription?: Prescription | null;
		/** Active lens type coming from the selected catalog lens, when it can be inferred */
		selectedCatalogLensType?: string | null;
		/** Whether there are multiple selected catalog lens types in the operation */
		hasMixedCatalogLensTypes?: boolean;
		/** Whether addition fields are visible (non-monofocal) - reserved for future use */
		showAddition?: boolean;
		/** Compact mode for inline use - reserved for future use */
		compact?: boolean;
		/** Per-field validation errors */
		errors?: PrescriptionFieldErrors;
	}

	let {
		values = $bindable(),
		existingPrescription = null,
		selectedCatalogLensType = null,
		hasMixedCatalogLensTypes = false,
		showAddition = false,
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
		if (
			existingPrescription.recommendedLensType &&
			selectedCatalogLensType === null &&
			!hasMixedCatalogLensTypes
		) {
			values.lensType = existingPrescription.recommendedLensType;
		}
		if (existingPrescription.doctorName) {
			values.doctorName = existingPrescription.doctorName;
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
		if (v == null) return '-';
		return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
	}

	function hasCylinder(value: number | null | undefined): boolean {
		return value != null && value !== 0;
	}

	function hasAddition(value: number | null | undefined): boolean {
		return value != null && value !== 0;
	}

	function isPrescriptionMonofocal(prescription: Prescription | null): boolean {
		return prescription?.recommendedLensType === LensType.MONOFOCAL;
	}

	function formatAxis(value: number | null | undefined): string {
		if (value == null) return '-';
		return `${Math.round(value)}°`;
	}

	function formatEyeSummary(
		eyeLabel: 'OD' | 'OI',
		sphere: number | null | undefined,
		cylinder: number | null | undefined,
		axis: number | null | undefined,
		addition: number | null | undefined,
		isMonofocalLens: boolean
	): string {
		const parts = [`${eyeLabel} ${formatOpt(sphere)}`];

		if (hasCylinder(cylinder)) {
			parts.push(`CIL ${formatOpt(cylinder)}`);
			parts.push(`EJE ${formatAxis(axis)}`);
		}

		if (!isMonofocalLens && hasAddition(addition)) {
			parts.push(`ADD ${formatOpt(addition)}`);
		}

		return parts.join(' · ');
	}
</script>

<div class:space-y-3={!_compact} class:space-y-2.5={_compact}>
	<!-- Autofill banner -->
	{#if canAutofill}
		{@const existingLensType =
			existingPrescription?.recommendedLensType != null
				? getLensTypeLabel(existingPrescription.recommendedLensType)
				: 'Fórmula guardada'}
		{@const existingIsMonofocal = isPrescriptionMonofocal(existingPrescription)}
		<div
			class="flex flex-col gap-3 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 sm:items-center"
		>
			<div class="min-w-0 flex-1">
				<p class="text-sm leading-tight font-bold text-emerald-800">
					¡Fórmula encontrada para este paciente!
				</p>
				<div class="mt-1 text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase">
					{existingLensType}
				</div>
				<div class="mt-2 grid gap-1.5 text-xs text-emerald-700">
					<span class="font-mono font-semibold break-words">
						{formatEyeSummary(
							'OD',
							existingPrescription?.odSphere,
							existingPrescription?.odCylinder,
							existingPrescription?.odAxis,
							existingPrescription?.odAddition,
							existingIsMonofocal
						)}
					</span>
					<span class="font-mono font-semibold break-words">
						{formatEyeSummary(
							'OI',
							existingPrescription?.osSphere,
							existingPrescription?.osCylinder,
							existingPrescription?.osAxis,
							existingPrescription?.osAddition,
							existingIsMonofocal
						)}
					</span>
				</div>
			</div>
			<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
				<button
					type="button"
					class="min-w-0 flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 sm:flex-none"
					onclick={applyAutofill}
				>
					Usar fórmula
				</button>
				<button
					type="button"
					class="min-w-0 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
					onclick={dismissAutofill}
				>
					Ignorar
				</button>
			</div>
		</div>
	{/if}

	<!-- Doctor name -->
	<div class={_compact ? 'space-y-1' : 'space-y-1'}>
		<Label class="text-xs font-medium text-slate-600">Médico / Optómetra</Label>
		<Input
			type="text"
			placeholder="Nombre del doctor"
			bind:value={values.doctorName}
			class="text-sm {errors?.doctorName ? '!border-red-400' : ''}"
		/>
		{#if errors?.doctorName}
			<p class="mt-0.5 text-xs text-red-500">{errors.doctorName}</p>
		{/if}
	</div>

	<!-- Lens type selector + Copy OD → OI -->
	<div class={_compact ? 'space-y-2' : 'flex items-center gap-3'}>
		<Label
			class={_compact
				? 'text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase'
				: 'shrink-0 text-sm font-semibold text-slate-700'}
		>
			Tipo de lente
		</Label>
		<Select bind:value={values.lensType} class={_compact ? 'w-full' : 'w-44'}>
			{#each lensTypeOptions as opt (opt.value)}
				<option value={opt.value}>{opt.name}</option>
			{/each}
		</Select>
		<button
			type="button"
			class={_compact
				? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100'
				: 'ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50'}
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
	<div class={_compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 gap-4 md:grid-cols-2'}>
		<!-- Left Eye (OI) — always first -->
		<div
			class={_compact
				? 'rounded-[1rem] border border-violet-200/80 bg-[linear-gradient(180deg,#fbf6ff_0%,#f4ecff_100%)] p-3.5 shadow-sm'
				: 'rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-violet-50/50 p-3'}
		>
			<div class="mb-2 flex items-center gap-2">
				<div class="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500">
					<Eye class="h-3 w-3 text-white" />
				</div>
				<h5 class="text-sm font-semibold text-violet-800">OI - Ojo Izquierdo</h5>
			</div>
			<div
				class={_compact
					? 'grid grid-cols-2 gap-2.5'
					: `grid grid-cols-2 gap-2 ${showAddition || !isMonofocal ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
			>
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
				<div class={_compact && isMonofocal && !showAddition ? 'col-span-2' : ''}>
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
				{#if showAddition || !isMonofocal}
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

		<!-- Right Eye (OD) — second -->
		<div
			class={_compact
				? 'rounded-[1rem] border border-blue-200/80 bg-[linear-gradient(180deg,#f4f8ff_0%,#edf4ff_100%)] p-3.5 shadow-sm'
				: 'rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 p-3'}
		>
			<div class="mb-2 flex items-center gap-2">
				<div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
					<Eye class="h-3 w-3 text-white" />
				</div>
				<h5 class="text-sm font-semibold text-blue-800">OD - Ojo Derecho</h5>
			</div>
			<div
				class={_compact
					? 'grid grid-cols-2 gap-2.5'
					: `grid grid-cols-2 gap-2 ${showAddition || !isMonofocal ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
			>
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
				<div class={_compact && isMonofocal && !showAddition ? 'col-span-2' : ''}>
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
				{#if showAddition || !isMonofocal}
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
	</div>
</div>
