<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { LensType, LENS_TYPE_LABELS } from '$lib/shared/enums/lensTypes';
	import { getFormErrorMessage } from '$lib/utils';
	import type {
		PrescriptionFieldIssues,
		PrescriptionFormData,
		PrescriptionFormFieldName
	} from './prescription-form';

	interface Props {
		data: PrescriptionFormData;
		issues?: PrescriptionFieldIssues;
		namePrefix?: string;
		availableTo?: Date;
		showCurrentToggle?: boolean;
	}

	let {
		data = $bindable(),
		issues,
		namePrefix = 'prescription',
		availableTo = new Date(),
		showCurrentToggle = true
	}: Props = $props();

	const showAddition = $derived(
		data.recommendedLensType !== '' && data.recommendedLensType !== LensType.MONOFOCAL
	);

	const showAltura = $derived(
		showAddition && (parseFloat(data.odAddition) > 0 || parseFloat(data.osAddition) > 0)
	);

	const maxPrescriptionDate = $derived(availableTo.toISOString().slice(0, 10));

	function fieldName(
		field: PrescriptionFormFieldName,
		options?: { omitWhenEmpty?: boolean }
	): string | undefined {
		if (options?.omitWhenEmpty && data[field] === '') {
			return undefined;
		}

		return namePrefix ? `${namePrefix}.${field}` : field;
	}

	function getIssues(field: PrescriptionFormFieldName): RemoteFormIssue[] | undefined {
		return issues?.[field]?.issues?.();
	}
</script>

{#snippet fieldError(field: PrescriptionFormFieldName)}
	{@const message = getFormErrorMessage(getIssues(field) ?? null)}
	{#if message}
		<p class="mt-1 text-xs text-red-600">{message}</p>
	{/if}
{/snippet}

<div class="space-y-5">
	<div class="grid items-end gap-4 sm:grid-cols-3">
		<div>
			<label
				for="rxDate"
				class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
			>
				Fecha de Fórmula<span class="text-error">*</span>
			</label>
			<input
				id="rxDate"
				name={fieldName('prescriptionDate')}
				type="date"
				bind:value={data.prescriptionDate}
				max={maxPrescriptionDate}
				class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
			/>
			{@render fieldError('prescriptionDate')}
		</div>
		<div>
			<label
				for="lensType"
				class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
			>
				Tipo de Lente
			</label>
			<select
				id="lensType"
				name={fieldName('recommendedLensType', { omitWhenEmpty: true })}
				bind:value={data.recommendedLensType}
				class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">— Seleccionar —</option>
				{#each Object.entries(LENS_TYPE_LABELS) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
			{@render fieldError('recommendedLensType')}
		</div>
		<div>
			<label
				for="doctorName"
				class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
			>
				Doctor
			</label>
			<input
				id="doctorName"
				name={fieldName('doctorName')}
				type="text"
				placeholder="Nombre del profesional"
				bind:value={data.doctorName}
				class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
			/>
			{@render fieldError('doctorName')}
		</div>
	</div>

	{#if showCurrentToggle}
		<label class="flex items-center gap-2.5">
			<input type="hidden" name={fieldName('isCurrent')} value="false" />
			<input
				type="checkbox"
				name={fieldName('isCurrent')}
				bind:checked={data.isCurrent}
				class="h-4 w-4 rounded border-outline-variant text-brand-gold focus:ring-brand-gold"
			/>
			<span class="text-sm font-bold tracking-wider text-on-surface uppercase">Fórmula Actual</span>
		</label>
	{/if}

	<div class="grid gap-5 lg:grid-cols-2">
		<div class="rounded-xl bg-surface-container-low p-5">
			<div class="mb-4 flex items-center gap-2.5">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
				>
					OD
				</div>
				<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
					>Ojo Derecho (OD)</span
				>
			</div>
			<div
				class="grid grid-cols-2 gap-3"
				class:grid-cols-2={!showAddition}
				class:sm:grid-cols-4={showAddition}
				class:sm:grid-cols-3={!showAddition}
			>
				<div>
					<label
						for="od-sphere"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Esfera
					</label>
					<input
						id="od-sphere"
						name={fieldName('odSphere')}
						type="text"
						inputmode="decimal"
						placeholder="-2.00"
						bind:value={data.odSphere}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('odSphere')}
				</div>
				<div>
					<label
						for="od-cylinder"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Cilindro
					</label>
					<input
						id="od-cylinder"
						name={fieldName('odCylinder')}
						type="text"
						inputmode="decimal"
						placeholder="-0.50"
						bind:value={data.odCylinder}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('odCylinder')}
				</div>
				<div>
					<label
						for="od-axis"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Eje
					</label>
					<input
						id="od-axis"
						name={fieldName('odAxis')}
						type="text"
						inputmode="numeric"
						placeholder="180"
						bind:value={data.odAxis}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('odAxis')}
				</div>
				{#if showAddition}
					<div>
						<label
							for="od-addition"
							class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
						>
							Adición
						</label>
						<input
							id="od-addition"
							name={fieldName('odAddition')}
							type="text"
							inputmode="decimal"
							placeholder="+1.50"
							bind:value={data.odAddition}
							class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
						/>
						{@render fieldError('odAddition')}
					</div>
				{/if}
			</div>
		</div>

		<div class="rounded-xl bg-surface-container-low p-5">
			<div class="mb-4 flex items-center gap-2.5">
				<div
					class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white"
				>
					OS
				</div>
				<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
					>Ojo Izquierdo (OS)</span
				>
			</div>
			<div
				class="grid grid-cols-2 gap-3"
				class:grid-cols-2={!showAddition}
				class:sm:grid-cols-4={showAddition}
				class:sm:grid-cols-3={!showAddition}
			>
				<div>
					<label
						for="os-sphere"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Esfera
					</label>
					<input
						id="os-sphere"
						name={fieldName('osSphere')}
						type="text"
						inputmode="decimal"
						placeholder="-1.75"
						bind:value={data.osSphere}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('osSphere')}
				</div>
				<div>
					<label
						for="os-cylinder"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Cilindro
					</label>
					<input
						id="os-cylinder"
						name={fieldName('osCylinder')}
						type="text"
						inputmode="decimal"
						placeholder="-0.25"
						bind:value={data.osCylinder}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('osCylinder')}
				</div>
				<div>
					<label
						for="os-axis"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Eje
					</label>
					<input
						id="os-axis"
						name={fieldName('osAxis')}
						type="text"
						inputmode="numeric"
						placeholder="175"
						bind:value={data.osAxis}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('osAxis')}
				</div>
				{#if showAddition}
					<div>
						<label
							for="os-addition"
							class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
						>
							Adición
						</label>
						<input
							id="os-addition"
							name={fieldName('osAddition')}
							type="text"
							inputmode="decimal"
							placeholder="+1.50"
							bind:value={data.osAddition}
							class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
						/>
						{@render fieldError('osAddition')}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<div>
			<h3 class="mb-3 text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
				Distancias
			</h3>
			<div class="grid grid-cols-3 gap-3">
				<div class="text-center">
					<label
						for="rx-dp"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						DP (mm)
					</label>
					<input
						id="rx-dp"
						name={fieldName('dp')}
						type="text"
						inputmode="numeric"
						placeholder="62"
						bind:value={data.dp}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('dp')}
				</div>
				<div class="text-center">
					<label
						for="rx-np-right"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						NP Der
					</label>
					<input
						id="rx-np-right"
						name={fieldName('npRight')}
						type="text"
						inputmode="numeric"
						placeholder="31"
						bind:value={data.npRight}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('npRight')}
				</div>
				<div class="text-center">
					<label
						for="rx-np-left"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						NP Izq
					</label>
					<input
						id="rx-np-left"
						name={fieldName('npLeft')}
						type="text"
						inputmode="numeric"
						placeholder="31"
						bind:value={data.npLeft}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('npLeft')}
				</div>
			</div>
			{#if showAltura}
				<div class="mt-3 w-1/3 text-center">
					<label
						for="rx-altura"
						class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
					>
						Altura (mm)
					</label>
					<input
						id="rx-altura"
						name={fieldName('altura')}
						type="text"
						inputmode="numeric"
						placeholder="18"
						bind:value={data.altura}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('altura')}
				</div>
			{/if}
		</div>

		<div>
			<h3 class="mb-3 text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
				Tratamientos
			</h3>
			<div class="flex flex-wrap gap-x-5 gap-y-3">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name={fieldName('treatmentAntiReflective')}
						bind:checked={data.treatmentAntiReflective}
						class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
					/>
					<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
						>Antireflejo</span
					>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name={fieldName('treatmentBlueBlock')}
						bind:checked={data.treatmentBlueBlock}
						class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
					/>
					<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
						>Blueblock</span
					>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name={fieldName('treatmentPhotochromic')}
						bind:checked={data.treatmentPhotochromic}
						class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
					/>
					<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
						>Fotocromático</span
					>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
						checked={data.treatmentOther !== ''}
						onchange={() => {
							if (data.treatmentOther) data.treatmentOther = '';
						}}
					/>
					<span class="text-xs font-semibold tracking-wider text-on-surface uppercase">Otros</span>
				</label>
			</div>

			{#if data.treatmentOther !== undefined}
				<div class="mt-3">
					<input
						type="text"
						name={fieldName('treatmentOther')}
						placeholder="Otros tratamientos..."
						bind:value={data.treatmentOther}
						class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-base text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
					/>
					{@render fieldError('treatmentOther')}
				</div>
			{/if}
		</div>
	</div>

	<div>
		<label
			for="rx-notes"
			class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
		>
			Notas de Fórmula
		</label>
		<textarea
			id="rx-notes"
			name={fieldName('notes')}
			placeholder="Observaciones técnicas, requerimientos específicos del paciente o detalles del tallado..."
			rows={3}
			bind:value={data.notes}
			class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
		></textarea>
		{@render fieldError('notes')}
	</div>
</div>
