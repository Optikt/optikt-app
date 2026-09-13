<script lang="ts">
	import { Layers3 } from '@lucide/svelte';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from '../prescription-form';
	import {
		fieldName,
		getIssues,
		hasFieldError,
		treatmentCardClass
	} from './prescriptionFieldUtils';
	import FieldError from './FieldError.svelte';

	interface Props {
		data: PrescriptionFormData;
		issues: PrescriptionFieldIssues | undefined;
		namePrefix: string;
	}

	let { data, issues, namePrefix }: Props = $props();
</script>

<section
	class="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[var(--ds-shadow-sm)]"
>
	<div class="mb-6 flex items-center gap-3">
		<span
			class="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gold/18 text-brand-navy"
		>
			<Layers3 class="h-4 w-4" />
		</span>
		<h3 class="text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase">Tratamientos</h3>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<label
			class={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-200 ${treatmentCardClass(data.treatmentAntiReflective)}`}
		>
			<input
				type="checkbox"
				name={fieldName(data, namePrefix, 'treatmentAntiReflective')}
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
				name={fieldName(data, namePrefix, 'treatmentBlueBlock')}
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
				name={fieldName(data, namePrefix, 'treatmentPhotochromic')}
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
			name={fieldName(data, namePrefix, 'treatmentOther')}
			placeholder="Descripción adicional"
			bind:value={data.treatmentOther}
			aria-invalid={hasFieldError(issues, 'treatmentOther') ? 'true' : undefined}
			data-field-error={hasFieldError(issues, 'treatmentOther') ? 'true' : undefined}
			class={`w-full rounded-2xl border px-4 py-3 text-sm text-on-surface shadow-sm placeholder:text-outline focus:ring-0 ${hasFieldError(issues, 'treatmentOther') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
		/>
		<FieldError issues={getIssues(issues, 'treatmentOther')} />
	</div>
</section>
