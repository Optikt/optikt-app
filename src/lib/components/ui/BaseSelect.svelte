<script lang="ts">
	import Svelecte from 'svelecte';
	import { Label } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';
	import {
		getSingleSelectValue,
		normalizeSingleSelectValue,
		type SelectChangeValue,
		type SelectOptionRecord
	} from '$lib/utils';

	interface Props {
		/** Selected value (ID) */
		value?: string;
		/** Options array */
		options?: object[];
		/** Which field on options is the ID */
		valueField?: string;
		/** Which field on options is the display label */
		labelField?: string;
		/** Placeholder text */
		placeholder?: string;
		/** Disable the select */
		disabled?: boolean;
		/** Label text above the select */
		label?: string;
		/** Show required asterisk after label */
		required?: boolean;
		/** Custom HTML renderer for options (prefer option/selection snippets instead) */
		renderer?: (item: object, isSelection?: boolean) => string;
		/** Snippet for rendering each dropdown option */
		option?: Snippet<[option: object, inputValue: string]>;
		/** Snippet for rendering the selected value */
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		selection?: Snippet<[selectedOptions: object[], bindItem: Function]>;
		/** Change handler */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		onChange?: (selected: any) => void;
		/** Enable creation of new options */
		creatable?: boolean;
		/** Handler for creating new options */
		createHandler?: (prop: {
			inputValue: string;
			valueField: string;
			labelField: string;
			prefix: string;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) => any;
		/** Prefix shown before new option text */
		creatablePrefix?: string;
		/** Keep created items in internal list */
		keepCreated?: boolean;
		/** Whether the field has an error */
		hasError?: boolean;
		/** Label class override */
		labelClass?: string;
		/** Visual variant for the select control */
		variant?: 'default' | 'tonal';
		/** Content rendered below the select (stock warnings, error messages, etc.) */
		footer?: Snippet;
	}

	let {
		value = $bindable(''),
		options = [],
		valueField = 'id',
		labelField = 'name',
		placeholder = 'Buscar...',
		disabled = false,
		label,
		required = false,
		renderer,
		option,
		selection,
		onChange,
		creatable = false,
		createHandler,
		creatablePrefix,
		keepCreated,
		hasError = false,
		labelClass = 'mb-1.5 text-sm',
		variant = 'default',
		footer
	}: Props = $props();

	let svelecteValue = $state<string | null>('');

	$effect(() => {
		const normalizedValue = normalizeSingleSelectValue(
			value,
			options as SelectOptionRecord[],
			valueField
		);

		if (svelecteValue !== normalizedValue) {
			svelecteValue = normalizedValue;
		}

		if (value !== normalizedValue) {
			value = normalizedValue;
		}
	});

	function handleChange(selected: object | object[] | string | string[] | null | undefined) {
		const nextValue = getSingleSelectValue(selected as SelectChangeValue, valueField);
		svelecteValue = nextValue;
		value = nextValue;
		onChange?.(selected);
	}
</script>

<div>
	{#if label}
		<Label class={labelClass}>
			{label}{#if required}<span class="ml-0.5 text-red-500">*</span>{/if}
		</Label>
	{/if}

	<Svelecte
		{placeholder}
		{disabled}
		{options}
		bind:value={svelecteValue}
		{valueField}
		{labelField}
		{renderer}
		{option}
		{selection}
		onChange={handleChange}
		{creatable}
		{createHandler}
		{creatablePrefix}
		{keepCreated}
		class={`base-select ${hasError ? 'base-select-error' : ''} ${variant === 'tonal' ? 'base-select-tonal' : ''}`}
	/>

	{#if footer}
		{@render footer()}
	{/if}
</div>

<style>
	/* ── Control overrides ─────────────────────────────────────────────── */
	:global(.base-select .sv-control) {
		border: 1px solid #d1d5db !important;
		border-radius: 0.5rem !important;
		min-height: 42px !important;
		background: #fff !important;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	:global(.base-select .sv-control:hover) {
		border-color: #9ca3af !important;
	}
	:global(.base-select .sv-control:focus-within) {
		border-color: #3b82f6 !important;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
	}

	/* ── CSS custom properties ─────────────────────────────────────────── */
	:global(.base-select) {
		--sv-bg: #ffffff;
		--sv-border: 1px solid #d1d5db;
		--sv-border-radius: 0.5rem;
		--sv-min-height: 42px;
		--sv-placeholder-color: #9ca3af;
		--sv-item-selected-bg: #eff6ff;
		--sv-highlight-bg: #dbeafe;
		--sv-dropdown-border: 1px solid #e2e8f0;
		--sv-dropdown-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		--sv-dropdown-height: 280px;
		--sv-dropdown-active-bg: #f8fafc;
		--sv-dropdown-selected-bg: #eff6ff;
	}

	:global(.base-select-tonal) {
		--sv-bg: var(--color-surface-container-low);
		--sv-border: 1px solid rgba(198, 198, 207, 0.45);
		--sv-placeholder-color: var(--color-outline);
		--sv-item-selected-bg: rgba(65, 158, 189, 0.08);
		--sv-highlight-bg: rgba(65, 158, 189, 0.12);
		--sv-dropdown-active-bg: var(--color-surface-container-low);
		--sv-dropdown-selected-bg: rgba(65, 158, 189, 0.12);
	}

	/* ── Error state ───────────────────────────────────────────────────── */
	:global(.base-select-error) {
		--sv-border: #ef4444;
	}
	:global(.base-select-error .sv-control) {
		border-color: #ef4444 !important;
	}

	/* ── Dark mode ─────────────────────────────────────────────────────── */
	:global(.dark .base-select) {
		--sv-bg: #1f2937;
		--sv-border: 1px solid #4b5563;
		--sv-placeholder-color: #6b7280;
		--sv-item-selected-bg: #1e3a5f;
		--sv-highlight-bg: #1e3a8a;
	}
	:global(.dark .base-select .sv-control) {
		border-color: #4b5563 !important;
		background: #1f2937 !important;
	}
</style>
