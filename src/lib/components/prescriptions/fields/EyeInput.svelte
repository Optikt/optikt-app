<script lang="ts">
	import type { PrescriptionFormData, PrescriptionFormFieldName } from '../prescription-form';
	import {
		getNumericFieldConfig,
		handleNumericInput,
		handleNumericKeydown,
		normalizeNumericField,
		type NumericField
	} from './numericFormat';
	import { fieldName, getIssues, hasFieldError } from './prescriptionFieldUtils';
	import FieldError from './FieldError.svelte';

	interface Props {
		data: PrescriptionFormData;
		field: PrescriptionFormFieldName;
		id: string;
		label: string;
		placeholder: string;
		issues: Parameters<typeof getIssues>[0];
		namePrefix: string;
	}

	let { data, field, id, label, placeholder, issues, namePrefix }: Props = $props();
	const fieldHasError = $derived(hasFieldError(issues, field));
	const config = $derived(getNumericFieldConfig(field as NumericField));
</script>

<div class="space-y-1.5">
	<div
		class={`rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors duration-200 ${fieldHasError ? 'border-error/45 bg-error-container/35 focus-within:border-error/60' : 'border-outline-variant/15 bg-surface-container-low focus-within:border-brand-blue/35 focus-within:bg-surface-container-lowest'}`}
	>
		<label
			for={id}
			class="mb-2 block text-xs font-bold tracking-[0.2em] text-on-surface-variant uppercase"
		>
			{label}
		</label>
		<input
			{id}
			name={fieldName(data, namePrefix, field)}
			type="number"
			inputmode={config.inputmode}
			step={config.step}
			min={config.min}
			max={config.max}
			{placeholder}
			value={data[field]}
			onkeydown={(event) => handleNumericKeydown(field as NumericField, event)}
			oninput={(event) => handleNumericInput(data, field as NumericField, event)}
			onblur={() => normalizeNumericField(data, field as NumericField)}
			aria-invalid={fieldHasError ? 'true' : undefined}
			data-field-error={fieldHasError ? 'true' : undefined}
			class="w-full border-0 bg-transparent px-0 py-1 text-center font-mono text-lg font-black text-brand-navy tabular-nums focus:ring-0"
		/>
	</div>
	<FieldError issues={getIssues(issues, field)} />
</div>
