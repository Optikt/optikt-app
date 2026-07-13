<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { getFormErrorMessage, dateToISODateString } from '$lib/utils';

	interface Props {
		value: Date | undefined;
		name?: string;
		label?: string;
		placeholder?: string;
		error?: RemoteFormIssue[] | string | null;
		required?: boolean;
		disabled?: boolean;
		availableTo?: Date;
	}

	let {
		value = $bindable(),
		name,
		label,
		placeholder = 'DD/MM/AAAA',
		error = null,
		required = false,
		disabled = false,
		availableTo
	}: Props = $props();

	const inputId = crypto.randomUUID();
	const isoValue = $derived(dateToISODateString(value));
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);

	const maxDate = $derived(availableTo ? formatInputValue(availableTo) : undefined);

	function onDateInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value;
		if (!val) {
			value = undefined;
			return;
		}
		const parts = val.split('-');
		if (parts.length === 3) {
			value = new Date(+parts[0], +parts[1] - 1, +parts[2]);
		}
	}

	function formatDisplay(d: Date | undefined): string {
		if (!d) return '';
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		return `${day}/${month}/${year}`;
	}

	function formatInputValue(d: Date | undefined): string {
		if (!d) return '';
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function openPicker() {
		const el = document.getElementById(inputId) as HTMLInputElement | null;
		el?.showPicker();
	}
</script>

<div data-form-field={name} data-field-error={hasError ? 'true' : undefined}>
	{#if label}
		<Label class={['mb-2 block', hasError ? 'text-red-500' : ''].join(' ')}>
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</Label>
	{/if}

	<div class="relative">
		<input
			type="text"
			{placeholder}
			value={formatDisplay(value)}
			readonly
			class={[
				'block w-full cursor-pointer rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
				'focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue',
				'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
				hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-300',
				!value && 'text-slate-400'
			]
				.filter(Boolean)
				.join(' ')}
			onclick={openPicker}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					openPicker();
				}
			}}
			role="combobox"
			aria-expanded="false"
			aria-haspopup="dialog"
			aria-label={label || 'Seleccionar fecha'}
		/>
		<input
			type="date"
			id={inputId}
			class="sr-only"
			value={formatInputValue(value)}
			{disabled}
			max={maxDate}
			onchange={onDateInput}
			tabindex="-1"
			aria-hidden="true"
		/>
	</div>

	{#if name}
		<input type="hidden" {name} value={isoValue} />
	{/if}

	{#if displayError}
		<p class="mt-1 text-sm text-red-500">{displayError}</p>
	{/if}
</div>
