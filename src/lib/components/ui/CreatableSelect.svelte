<script lang="ts">
	import BaseSelect from './BaseSelect.svelte';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { normalizeSingleSelectValue } from '$lib/utils';

	export type SelectOption = {
		id: string;
		name: string;
		/** Marks this as a pending/virtual option not yet saved to DB */
		isPending?: boolean;
	};

	export type PendingEntity = {
		pendingId: string;
		name: string;
		[key: string]: unknown;
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
		/**
		 * Enable creation of new options.
		 * When true, typing a non-existent value shows "Crear: X" option.
		 * New options are stored locally with isPending=true until form submit.
		 */
		creatable?: boolean;
		/**
		 * Callback when a NEW option is created (deferred mode).
		 * Called with the new name, should return a pending option.
		 * This does NOT save to DB - that happens on form submit.
		 */
		onCreatePending?: (name: string) => SelectOption;
		/** Callback when value changes */
		onchange?: (option: SelectOption | null) => void;
		/** Error message to display below the select */
		error?: string | null;
		/** Label class override */
		labelClass?: string;
		/** Visual variant for the select control */
		variant?: 'default' | 'tonal';
	};

	let {
		value = $bindable(''),
		options = [],
		label,
		placeholder = 'Buscar...',
		name,
		required = false,
		disabled = false,
		creatable = false,
		onCreatePending,
		onchange,
		error = null,
		labelClass,
		variant = 'default'
	}: Props = $props();

	// Track local options (newly created pending ones)
	let localOptions = $state<SelectOption[]>([]);

	// Merge options with locally created ones
	const allOptions = $derived([...options, ...localOptions]);

	// Internal state for Svelecte (the selected ID as a string)
	// We need $state here because we mutate it in handleChange
	let internalValue = $state(value);

	// Sync external value changes to internal state
	$effect(() => {
		const normalizedValue = normalizeSingleSelectValue(value, allOptions, 'id');
		internalValue = normalizedValue;

		if (value !== normalizedValue) {
			value = normalizedValue;
		}
	});

	/**
	 * Handle creation of a new option.
	 * This creates a PENDING option with a temporary ID.
	 * The actual DB save happens on form submit.
	 */
	function handleCreate(props: {
		inputValue: string;
		valueField: string;
		labelField: string;
		prefix: string;
	}): SelectOption | Promise<SelectOption> | object {
		if (!creatable) return {};

		const inputValue = props.inputValue.trim();

		// Check if already exists in ALL options (case insensitive)
		const exists = allOptions.some((opt) => opt.name.toLowerCase() === inputValue.toLowerCase());
		if (exists) {
			return allOptions.find((opt) => opt.name.toLowerCase() === inputValue.toLowerCase())!;
		}

		let newOption: SelectOption;

		if (onCreatePending) {
			newOption = onCreatePending(inputValue);
		} else {
			newOption = {
				id: `pending_${generateUUID()}`,
				name: inputValue,
				isPending: true
			};
		}

		localOptions = [...localOptions, newOption];
		return newOption;
	}

	/**
	 * Handle selection change from Svelecte
	 */
	function handleChange(selected: SelectOption | null) {
		const newValue = selected?.id ?? '';
		value = newValue;
		internalValue = newValue;
		onchange?.(selected);
	}
</script>

<div class="flex flex-col gap-1">
	<!-- Always emit the field so FormData never omits it -->
	<input type="hidden" {name} value={value ?? ''} />

	<BaseSelect
		{label}
		{labelClass}
		{required}
		{placeholder}
		{disabled}
		options={allOptions}
		bind:value={internalValue}
		{creatable}
		createHandler={handleCreate}
		creatablePrefix="Crear: "
		keepCreated={false}
		onChange={handleChange}
		{variant}
		hasError={!!error}
	/>

	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}
</div>
