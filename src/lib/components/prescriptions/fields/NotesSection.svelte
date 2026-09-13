<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from '../prescription-form';
	import { fieldName, getIssues, hasFieldError } from './prescriptionFieldUtils';
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
	<div class="mb-4 flex items-center gap-3">
		<span
			class="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-navy/10 text-brand-navy"
		>
			<FileText class="h-4 w-4" />
		</span>
		<h3 class="text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase">Observaciones</h3>
	</div>

	<textarea
		id="rx-notes"
		name={fieldName(data, namePrefix, 'notes')}
		placeholder="Notas clínicas adicionales, especificaciones de montaje o consideraciones del paciente..."
		rows={5}
		bind:value={data.notes}
		aria-invalid={hasFieldError(issues, 'notes') ? 'true' : undefined}
		data-field-error={hasFieldError(issues, 'notes') ? 'true' : undefined}
		class={`min-h-[160px] w-full resize-none rounded-2xl border px-4 py-3 text-sm text-on-surface shadow-sm placeholder:text-outline focus:ring-0 ${hasFieldError(issues, 'notes') ? 'border-error/45 bg-error-container/35 focus:border-error/60' : 'border-outline-variant/15 bg-surface-container-lowest focus:border-brand-blue'}`}
	></textarea>
	<FieldError issues={getIssues(issues, 'notes')} />
</section>
