<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Eye, FileText, Layers3, Ruler } from '@lucide/svelte';
	import { LensType, LENS_TYPE_LABELS } from '$lib/shared/enums/lensTypes';
	import { dateToISODateString, getFormErrorMessage } from '$lib/utils';
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

	const showAltura = $derived(showAddition);

	const maxPrescriptionDate = $derived(dateToISODateString(availableTo));

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

	function hasFieldError(field: PrescriptionFormFieldName): boolean {
		return (getIssues(field)?.length ?? 0) > 0;
	}

	function treatmentCardClass(selected: boolean): string {
		return selected
			? 'border-brand-blue/30 bg-brand-blue/10 text-brand-navy shadow-[var(--ds-shadow-sm)]'
			: 'border-outline-variant/15 bg-surface text-on-surface';
	}
</script>

{#snippet fieldError(field: PrescriptionFormFieldName)}
	{@const message = getFormErrorMessage(getIssues(field) ?? null)}
	{#if message}
		<p class="form-field-error mt-1 text-xs font-medium text-error">{message}</p>
	{/if}
{/snippet}

{#snippet eyeInput(
	field: PrescriptionFormFieldName,
	id: string,
	label: string,
	placeholder: string,
	inputmode: 'decimal' | 'numeric'
)}
	{@const fieldHasError = hasFieldError(field)}
	<div class="space-y-1.5">
		<div
			class={`rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors duration-200 ${fieldHasError ? 'border-error/45 bg-error-container/35 focus-within:border-error/60' : 'border-outline-variant/15 bg-surface-container-low focus-within:border-brand-blue/35 focus-within:bg-surface-container-lowest'}`}
		>
			<label
				for={id}
				class="mb-2 block text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase"
			>
				{label}
			</label>
			<input
				{id}
				name={fieldName(field)}
				type="text"
				{inputmode}
				{placeholder}
				bind:value={data[field]}
				aria-invalid={fieldHasError ? 'true' : undefined}
				data-field-error={fieldHasError ? 'true' : undefined}
				class="w-full border-0 bg-transparent px-0 py-1 text-center font-mono text-lg font-black text-brand-navy tabular-nums focus:ring-0"
			/>
		</div>
		{@render fieldError(field)}
	</div>
{/snippet}

<div class="space-y-8">
	<section
		class="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-sm)]"
	>
		<div class="grid gap-6 md:grid-cols-4 md:items-end">
			<div>
				<label
					for="lensType"
					class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
				>
					Tipo de Lente<span class="text-error">*</span>
				</label>
				<select
					id="lensType"
					name={fieldName('recommendedLensType')}
					bind:value={data.recommendedLensType}
					aria-invalid={hasFieldError('recommendedLensType') ? 'true' : undefined}
					data-field-error={hasFieldError('recommendedLensType') ? 'true' : undefined}
					required
					class={`w-full rounded-xl border px-4 py-3 text-sm text-on-surface shadow-sm focus:ring-0 ${hasFieldError('recommendedLensType') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
				>
					<option value="">Seleccionar</option>
					{#each Object.entries(LENS_TYPE_LABELS) as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
				{@render fieldError('recommendedLensType')}
			</div>

			<div>
				<label
					for="doctorName"
					class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
				>
					Optometrista<span class="text-error">*</span>
				</label>
				<input
					id="doctorName"
					name={fieldName('doctorName')}
					type="text"
					placeholder="Nombre del profesional"
					bind:value={data.doctorName}
					aria-invalid={hasFieldError('doctorName') ? 'true' : undefined}
					data-field-error={hasFieldError('doctorName') ? 'true' : undefined}
					required
					class={`w-full rounded-xl border px-4 py-3 text-sm text-on-surface shadow-sm placeholder:text-outline focus:ring-0 ${hasFieldError('doctorName') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
				/>
				{@render fieldError('doctorName')}
			</div>

			<div>
				<label
					for="rxDate"
					class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
				>
					Fecha de Fórmula<span class="text-error">*</span>
				</label>
				<input
					id="rxDate"
					name={fieldName('prescriptionDate')}
					type="date"
					bind:value={data.prescriptionDate}
					max={maxPrescriptionDate}
					aria-invalid={hasFieldError('prescriptionDate') ? 'true' : undefined}
					data-field-error={hasFieldError('prescriptionDate') ? 'true' : undefined}
					class={`w-full rounded-xl border px-4 py-3 text-sm text-on-surface shadow-sm focus:ring-0 ${hasFieldError('prescriptionDate') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
				/>
				{@render fieldError('prescriptionDate')}
			</div>

			{#if showCurrentToggle}
				<div class="flex items-center justify-start pt-2 md:justify-end md:pb-2">
					<label
						class="inline-flex items-center gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 shadow-[var(--ds-shadow-sm)]"
					>
						<input
							type="hidden"
							name={fieldName('isCurrent')}
							value={data.isCurrent ? 'true' : 'false'}
						/>
						<input
							type="checkbox"
							bind:checked={data.isCurrent}
							class="h-4 w-4 rounded border border-brand-gold/30 bg-surface-container-lowest text-brand-navy focus:ring-0"
						/>
						<span class="text-[11px] font-bold tracking-[0.18em] text-brand-navy uppercase"
							>Fórmula Actual</span
						>
					</label>
				</div>
			{/if}
		</div>
	</section>

	<section class="grid gap-8 xl:grid-cols-2">
		<div
			class="overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-[var(--ds-shadow-md)]"
		>
			<div class="flex items-center justify-between bg-brand-navy px-5 py-4">
				<h2 class="font-heading text-lg font-black tracking-[0.06em] text-white uppercase">
					Ojo Derecho (OD)
				</h2>
				<Eye class="h-4 w-4 text-brand-gold" />
			</div>
			<div class="p-6">
				<div
					class="grid grid-cols-2 gap-4"
					class:lg:grid-cols-4={showAddition}
					class:lg:grid-cols-3={!showAddition}
				>
					{@render eyeInput('odSphere', 'od-sphere', 'Esfera', '-2.00', 'decimal')}
					{@render eyeInput('odCylinder', 'od-cylinder', 'Cilindro', '-0.50', 'decimal')}
					{@render eyeInput('odAxis', 'od-axis', 'Eje', '180', 'numeric')}
					{#if showAddition}
						{@render eyeInput('odAddition', 'od-addition', 'Adición', '+1.50', 'decimal')}
					{/if}
				</div>
			</div>
		</div>

		<div
			class="overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-[var(--ds-shadow-md)]"
		>
			<div class="flex items-center justify-between bg-brand-blue px-5 py-4">
				<h2 class="font-heading text-lg font-black tracking-[0.06em] text-white uppercase">
					Ojo Izquierdo (OS)
				</h2>
				<Eye class="h-4 w-4 text-brand-gold" />
			</div>
			<div class="p-6">
				<div
					class="grid grid-cols-2 gap-4"
					class:lg:grid-cols-4={showAddition}
					class:lg:grid-cols-3={!showAddition}
				>
					{@render eyeInput('osSphere', 'os-sphere', 'Esfera', '-1.75', 'decimal')}
					{@render eyeInput('osCylinder', 'os-cylinder', 'Cilindro', '-0.25', 'decimal')}
					{@render eyeInput('osAxis', 'os-axis', 'Eje', '175', 'numeric')}
					{#if showAddition}
						{@render eyeInput('osAddition', 'os-addition', 'Adición', '+1.50', 'decimal')}
					{/if}
				</div>
			</div>
		</div>
	</section>

	<div class="grid gap-8 xl:grid-cols-2">
		<section
			class="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-sm)]"
		>
			<div class="mb-6 flex items-center gap-3">
				<span
					class="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-blue/12 text-brand-blue"
				>
					<Ruler class="h-4 w-4" />
				</span>
				<h3 class="text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase">Distancias</h3>
			</div>

			<div
				class="grid gap-4 sm:grid-cols-2"
				class:xl:grid-cols-4={showAltura}
				class:xl:grid-cols-3={!showAltura}
			>
				<div>
					<label
						for="rx-dp"
						class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
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
						aria-invalid={hasFieldError('dp') ? 'true' : undefined}
						data-field-error={hasFieldError('dp') ? 'true' : undefined}
						class={`w-full rounded-2xl border px-4 py-3 text-right font-mono font-bold text-brand-navy tabular-nums shadow-sm focus:ring-0 ${hasFieldError('dp') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
					/>
					{@render fieldError('dp')}
				</div>

				<div>
					<label
						for="rx-np-right"
						class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
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
						aria-invalid={hasFieldError('npRight') ? 'true' : undefined}
						data-field-error={hasFieldError('npRight') ? 'true' : undefined}
						class={`w-full rounded-2xl border px-4 py-3 text-right font-mono font-bold text-brand-navy tabular-nums shadow-sm focus:ring-0 ${hasFieldError('npRight') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
					/>
					{@render fieldError('npRight')}
				</div>

				<div>
					<label
						for="rx-np-left"
						class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
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
						aria-invalid={hasFieldError('npLeft') ? 'true' : undefined}
						data-field-error={hasFieldError('npLeft') ? 'true' : undefined}
						class={`w-full rounded-2xl border px-4 py-3 text-right font-mono font-bold text-brand-navy tabular-nums shadow-sm focus:ring-0 ${hasFieldError('npLeft') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
					/>
					{@render fieldError('npLeft')}
				</div>

				{#if showAltura}
					<div>
						<label
							for="rx-altura"
							class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
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
							aria-invalid={hasFieldError('altura') ? 'true' : undefined}
							data-field-error={hasFieldError('altura') ? 'true' : undefined}
							class={`w-full rounded-2xl border px-4 py-3 text-right font-mono font-bold text-brand-navy tabular-nums shadow-sm focus:ring-0 ${hasFieldError('altura') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
						/>
						{@render fieldError('altura')}
					</div>
				{/if}
			</div>
		</section>

		<section
			class="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-sm)]"
		>
			<div class="mb-6 flex items-center gap-3">
				<span
					class="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gold/18 text-brand-navy"
				>
					<Layers3 class="h-4 w-4" />
				</span>
				<h3 class="text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase">
					Tratamientos
				</h3>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<label
					class={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-200 ${treatmentCardClass(data.treatmentAntiReflective)}`}
				>
					<input
						type="checkbox"
						name={fieldName('treatmentAntiReflective')}
						bind:checked={data.treatmentAntiReflective}
						class="h-4 w-4 rounded border border-outline-variant/20 bg-surface-container-high text-brand-blue focus:ring-0"
					/>
					<span class="text-sm font-semibold">Antireflejo</span>
				</label>

				<label
					class={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-200 ${treatmentCardClass(data.treatmentBlueBlock)}`}
				>
					<input
						type="checkbox"
						name={fieldName('treatmentBlueBlock')}
						bind:checked={data.treatmentBlueBlock}
						class="h-4 w-4 rounded border border-outline-variant/20 bg-surface-container-high text-brand-blue focus:ring-0"
					/>
					<span class="text-sm font-semibold">Blueblock</span>
				</label>

				<label
					class={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-200 ${treatmentCardClass(data.treatmentPhotochromic)}`}
				>
					<input
						type="checkbox"
						name={fieldName('treatmentPhotochromic')}
						bind:checked={data.treatmentPhotochromic}
						class="h-4 w-4 rounded border border-outline-variant/20 bg-surface-container-high text-brand-blue focus:ring-0"
					/>
					<span class="text-sm font-semibold">Fotocromático</span>
				</label>
			</div>

			<div class="mt-4">
				<label
					for="rx-treatment-other"
					class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
				>
					Otro Tratamiento
				</label>
				<input
					id="rx-treatment-other"
					type="text"
					name={fieldName('treatmentOther')}
					placeholder="Descripción adicional"
					bind:value={data.treatmentOther}
					aria-invalid={hasFieldError('treatmentOther') ? 'true' : undefined}
					data-field-error={hasFieldError('treatmentOther') ? 'true' : undefined}
					class={`w-full rounded-2xl border px-4 py-3 text-sm text-on-surface shadow-sm placeholder:text-outline focus:ring-0 ${hasFieldError('treatmentOther') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
				/>
				{@render fieldError('treatmentOther')}
			</div>
		</section>
	</div>

	<section
		class="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-sm)]"
	>
		<div class="mb-4 flex items-center gap-3">
			<span
				class="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-navy/10 text-brand-navy"
			>
				<FileText class="h-4 w-4" />
			</span>
			<h3 class="text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase">
				Observaciones
			</h3>
		</div>

		<textarea
			id="rx-notes"
			name={fieldName('notes')}
			placeholder="Notas clínicas adicionales, especificaciones de montaje o consideraciones del paciente..."
			rows={5}
			bind:value={data.notes}
			aria-invalid={hasFieldError('notes') ? 'true' : undefined}
			data-field-error={hasFieldError('notes') ? 'true' : undefined}
			class={`min-h-[160px] w-full resize-none rounded-2xl border px-4 py-3 text-sm text-on-surface shadow-sm placeholder:text-outline focus:ring-0 ${hasFieldError('notes') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
		></textarea>
		{@render fieldError('notes')}
	</section>
</div>
