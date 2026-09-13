<script lang="ts">
	import { LENS_TYPE_LABELS } from '$lib/shared/enums/lensTypes';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from '../prescription-form';
	import { fieldName, getIssues, hasFieldError } from './prescriptionFieldUtils';
	import FieldError from './FieldError.svelte';

	interface Props {
		data: PrescriptionFormData;
		issues: PrescriptionFieldIssues | undefined;
		namePrefix: string;
		maxPrescriptionDate: string;
		showCurrentToggle: boolean;
	}

	let { data, issues, namePrefix, maxPrescriptionDate, showCurrentToggle }: Props = $props();
</script>

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
				name={fieldName(data, namePrefix, 'recommendedLensType')}
				bind:value={data.recommendedLensType}
				aria-invalid={hasFieldError(issues, 'recommendedLensType') ? 'true' : undefined}
				data-field-error={hasFieldError(issues, 'recommendedLensType') ? 'true' : undefined}
				required
				class={`w-full rounded-xl border px-4 py-3 text-sm text-on-surface shadow-sm focus:ring-0 ${hasFieldError(issues, 'recommendedLensType') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
			>
				<option value="">Seleccionar</option>
				{#each Object.entries(LENS_TYPE_LABELS) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
			<FieldError issues={getIssues(issues, 'recommendedLensType')} />
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
				name={fieldName(data, namePrefix, 'doctorName')}
				type="text"
				placeholder="Nombre del profesional"
				bind:value={data.doctorName}
				aria-invalid={hasFieldError(issues, 'doctorName') ? 'true' : undefined}
				data-field-error={hasFieldError(issues, 'doctorName') ? 'true' : undefined}
				required
				class={`w-full rounded-xl border px-4 py-3 text-sm text-on-surface shadow-sm placeholder:text-outline focus:ring-0 ${hasFieldError(issues, 'doctorName') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
			/>
			<FieldError issues={getIssues(issues, 'doctorName')} />
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
				name={fieldName(data, namePrefix, 'prescriptionDate')}
				type="date"
				bind:value={data.prescriptionDate}
				max={maxPrescriptionDate}
				aria-invalid={hasFieldError(issues, 'prescriptionDate') ? 'true' : undefined}
				data-field-error={hasFieldError(issues, 'prescriptionDate') ? 'true' : undefined}
				class={`w-full rounded-xl border px-4 py-3 text-sm text-on-surface shadow-sm focus:ring-0 ${hasFieldError(issues, 'prescriptionDate') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
			/>
			<FieldError issues={getIssues(issues, 'prescriptionDate')} />
		</div>

		{#if showCurrentToggle}
			<div class="flex items-center justify-start pt-2 md:justify-end md:pb-2">
				<label
					class="inline-flex items-center gap-3 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 shadow-[var(--ds-shadow-sm)]"
				>
					<input
						type="hidden"
						name={fieldName(data, namePrefix, 'isCurrent')}
						value={data.isCurrent ? 'true' : 'false'}
					/>
					<input
						type="checkbox"
						bind:checked={data.isCurrent}
						class="h-4 w-4 rounded border border-brand-gold/30 bg-surface-container-lowest text-brand-navy focus:ring-0"
					/>
					<span class="text-xs font-bold tracking-[0.18em] text-brand-navy uppercase"
						>Fórmula Actual</span
					>
				</label>
			</div>
		{/if}
	</div>
</section>
