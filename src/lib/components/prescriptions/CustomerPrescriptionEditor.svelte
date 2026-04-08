<script lang="ts">
	import { Calendar, CheckCircle2, Save, User } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { formatDate, getFullName, parseISODateToLocal } from '$lib/utils';
	import type { Customer } from '$lib/server/db/schema';
	import PrescriptionFormFields from './PrescriptionFormFields.svelte';
	import type { PrescriptionFieldIssues, PrescriptionFormData } from './prescription-form';

	interface HiddenField {
		name: string;
		value: string;
	}

	interface Props {
		customer: Customer;
		mode: 'create' | 'edit';
		data: PrescriptionFormData;
		issues?: PrescriptionFieldIssues;
		formProps?: Record<string, unknown>;
		hiddenFields?: HiddenField[];
		isSubmitting?: boolean;
		onBack: () => void;
		onCancel: () => void;
	}

	let {
		customer,
		mode,
		data = $bindable(),
		issues,
		formProps = {},
		hiddenFields = [],
		isSubmitting = false,
		onBack,
		onCancel
	}: Props = $props();

	const title = $derived(mode === 'create' ? 'Nueva Fórmula' : 'Editar Fórmula');
	const submitLabel = $derived(mode === 'create' ? 'Crear Fórmula' : 'Guardar Fórmula');
	const activeDate = $derived(parseISODateToLocal(data.prescriptionDate) ?? new Date());
	const dateChipLabel = $derived(
		`${mode === 'create' ? 'Hoy' : 'Fecha'}: ${formatDate(activeDate, {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).toUpperCase()}`
	);
</script>

{#snippet headerActions()}
	<div
		class="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2.5 shadow-[var(--ds-shadow-sm)]"
	>
		<Calendar class="h-4 w-4 text-brand-blue" />
		<div>
			<p class="text-[10px] font-bold tracking-[0.18em] text-on-surface-variant uppercase">
				Referencia
			</p>
			<p class="text-[11px] font-bold tracking-[0.18em] text-brand-navy uppercase">
				{dateChipLabel}
			</p>
		</div>
	</div>
{/snippet}

<div class="w-full px-6 pb-10 md:px-8 md:pb-12">
	<div class="space-y-6">
		<PageHeader
			{title}
			backLabel={`Volver a ${getFullName(customer)}`}
			backOnClick={onBack}
			actions={headerActions}
		/>

		<div class="flex flex-wrap items-center gap-3 text-on-surface-variant">
			<div
				class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-sm shadow-[var(--ds-shadow-sm)]"
			>
				<User class="h-4 w-4 text-brand-blue" />
				<span class="font-medium tracking-wide text-brand-navy">{getFullName(customer)}</span>
			</div>
			{#if customer.idNumber}
				<span
					class="rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2 font-mono text-sm text-on-surface-variant tabular-nums shadow-[var(--ds-shadow-sm)]"
				>
					{customer.idNumber}
				</span>
			{/if}
		</div>

		<form {...formProps} class="space-y-8">
			{#each hiddenFields as field (field.name)}
				<input type="hidden" name={field.name} value={field.value} />
			{/each}

			<PrescriptionFormFields bind:data {issues} namePrefix="" />

			<footer
				class="flex flex-col gap-3 border-t border-outline-variant/15 pt-8 pb-10 sm:flex-row sm:items-center sm:justify-end"
			>
				<button
					type="button"
					onclick={onCancel}
					class="font-heading inline-flex cursor-pointer items-center justify-center rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-8 py-3 text-[11px] font-bold tracking-[0.18em] text-brand-navy uppercase transition-colors duration-200 hover:border-brand-blue/30 hover:text-brand-blue"
				>
					Cancelar
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					class="font-heading inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-gold px-10 py-3 text-[11px] font-bold tracking-[0.2em] text-brand-navy uppercase shadow-[0_14px_30px_rgba(252,208,30,0.28)] transition-colors duration-200 hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if isSubmitting}
						<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
						></span>
					{:else if mode === 'create'}
						<CheckCircle2 class="h-4 w-4" />
					{:else}
						<Save class="h-4 w-4" />
					{/if}
					{submitLabel}
				</button>
			</footer>
		</form>
	</div>
</div>
