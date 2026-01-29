<script lang="ts">
	import Svelecte from 'svelecte';

	type SelectOption = {
		id: string;
		name: string;
	};

	type Props = {
		/** Current selected value (id) */
		value: string;
		/** Available options */
		options: SelectOption[];
		/** Label for the select */
		label?: string;
		/** Placeholder text */
		placeholder?: string;
		/** Name for form submission */
		name?: string;
		/** Whether the field is required */
		required?: boolean;
		/** Disable the select */
		disabled?: boolean;
		/** Callback when a new option is created */
		oncreate?: (name: string) => Promise<SelectOption>;
		/** Callback when value changes */
		onchange?: (id: string) => void;
	};

	let {
		value = $bindable(''),
		options = [],
		label,
		placeholder = 'Buscar...',
		name,
		required = false,
		disabled = false,
		oncreate,
		onchange
	}: Props = $props();

	// Track local options to add newly created ones
	let localOptions = $state<SelectOption[]>([]);
	let isCreating = $state(false);

	// Merge options with locally created ones
	let allOptions = $derived([...options, ...localOptions]);

	// Find selected option by value
	let selectedOption = $derived(allOptions.find((opt) => opt.id === value) ?? null);

	async function handleCreate(inputValue: string) {
		if (!oncreate || isCreating) return null;

		isCreating = true;
		try {
			const newOption = await oncreate(inputValue);
			localOptions = [...localOptions, newOption];
			value = newOption.id;
			onchange?.(newOption.id);
			return newOption;
		} catch (error) {
			console.error('Error creating option:', error);
			return null;
		} finally {
			isCreating = false;
		}
	}

	function handleChange(event: CustomEvent<SelectOption | null>) {
		const selected = event.detail;
		value = selected?.id ?? '';
		onchange?.(value);
	}
</script>

<div class="flex flex-col gap-1">
	{#if label}
		<label for={name} class="text-sm font-medium text-gray-700 dark:text-gray-200">
			{label}{#if required}<span class="ml-0.5 text-red-500">*</span>{/if}
		</label>
	{/if}

	<Svelecte
		{name}
		{placeholder}
		{disabled}
		options={allOptions}
		value={selectedOption}
		valueField="id"
		labelField="name"
		creatable={!!oncreate}
		createHandler={handleCreate}
		creatablePrefix="Crear: "
		keepCreated={false}
		on:change={handleChange}
		class="creatable-select"
	/>

	{#if name}
		<input type="hidden" {name} {value} />
	{/if}
</div>

<style>
	:global(.creatable-select) {
		--sv-bg: #ffffff;
		--sv-border: #d1d5db;
		--sv-border-radius: 0.5rem;
		--sv-min-height: 42px;
		--sv-placeholder-color: #9ca3af;
		--sv-item-selected-bg: #eff6ff;
		--sv-highlight-bg: #dbeafe;
	}

	:global(.dark .creatable-select) {
		--sv-bg: #1f2937;
		--sv-border: #4b5563;
		--sv-placeholder-color: #6b7280;
		--sv-item-selected-bg: #1e3a5f;
		--sv-highlight-bg: #1e3a8a;
	}
</style>
