<script lang="ts">
	import type { PrescriptionFormData } from '../prescription-form';
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
		field: NumericField;
		id: string;
		label: string;
		placeholder: string;
		issues: Parameters<typeof getIssues>[0];
		namePrefix: string;
	}

	let { data, field, id, label, placeholder, issues, namePrefix }: Props = $props();
	const fieldHasError = $derived(hasFieldError(issues, field));
	const config = $derived(getNumericFieldConfig(field));
</script>

<div>
	<label
		for={id}
		class="mb-2 block text-[11px] font-bold tracking-[0.18em] text-on-surface-variant uppercase"
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
		onkeydown={(event) => handleNumericKeydown(field, event)}
		oninput={(event) => handleNumericInput(data, field, event)}
		onblur={() => normalizeNumericField(data, field)}
		aria-invalid={fieldHasError ? 'true' : undefined}
		data-field-error={fieldHasError ? 'true' : undefined}
		class={`w-full rounded-2xl border px-4 py-3 text-right font-mono font-bold text-brand-navy tabular-nums shadow-sm focus:ring-0 ${fieldHasError ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
	/>
	<FieldError issues={getIssues(issues, field)} />
</div>
