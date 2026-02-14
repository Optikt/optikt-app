<script lang="ts">
	import Svelecte from 'svelecte';
	import { generateUUID } from '$lib/utils/generateUUID';

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
		error = null
	}: Props = $props();

	// Track local options (newly created pending ones)
	let localOptions = $state<SelectOption[]>([]);

	// Merge options with locally created ones
	let allOptions = $derived([...options, ...localOptions]);

	// Internal state for Svelecte (the selected ID as a string)
	// We need $state here because we mutate it in handleChange
	// eslint-disable-next-line svelte/prefer-writable-derived
	let internalValue = $state(value);

	// Sync external value changes to internal state
	$effect(() => {
		internalValue = value;
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
			// Return the existing option instead of creating a duplicate
			return allOptions.find((opt) => opt.name.toLowerCase() === inputValue.toLowerCase())!;
		}

		let newOption: SelectOption;

		if (onCreatePending) {
			// Use custom handler
			newOption = onCreatePending(inputValue);
		} else {
			// Default: create with temp ID
			newOption = {
				id: `pending_${generateUUID()}`,
				name: inputValue,
				isPending: true
			};
		}

		// Add to local options
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

	/**
	 * Get all pending options that need to be saved.
	 * Call this before form submit to get items to create.
	 */
	export function getPendingOptions(): SelectOption[] {
		return localOptions.filter((opt) => opt.isPending);
	}

	/**
	 * Update a pending option with real data after saving to DB.
	 * Call this after creating in DB to update the ID.
	 */
	export function resolvePendingOption(pendingId: string, realOption: SelectOption) {
		localOptions = localOptions.map((opt) =>
			opt.id === pendingId ? { ...realOption, isPending: false } : opt
		);
		// Update value if this was the selected option
		if (value === pendingId) {
			value = realOption.id;
		}
	}

	/**
	 * Clear all pending options (e.g., on form reset)
	 */
	export function clearPending() {
		localOptions = localOptions.filter((opt) => !opt.isPending);
	}
</script>

<div class="flex flex-col gap-1">
	{#if label}
		<label for={name} class="text-sm font-medium text-gray-700 dark:text-gray-200">
			{label}{#if required}<span class="ml-0.5 text-red-500">*</span>{/if}
		</label>
	{/if}

	<!-- Always emit the field so FormData never omits it -->
	<input type="hidden" {name} value={value ?? ''} />

	<Svelecte
		{placeholder}
		{disabled}
		options={allOptions}
		bind:value={internalValue}
		valueField="id"
		labelField="name"
		{creatable}
		createHandler={handleCreate}
		creatablePrefix="Crear: "
		keepCreated={false}
		onChange={handleChange}
		class="creatable-select {error ? 'creatable-select-error' : ''}"
	/>

	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
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

	:global(.creatable-select-error) {
		--sv-border: #ef4444;
	}
</style>
