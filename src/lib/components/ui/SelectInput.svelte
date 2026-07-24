<script lang="ts">
	/**
	 * @deprecated Usar SupplierCombobox (src/lib/components/purchases/step1/) o el Combobox
	 * de shadcn-svelte. Svelecte tiene limitaciones de estilizado que son inconsistentes con
	 * el resto de inputs del wizard de compras.
	 *
	 * Para nuevas funcionalidades con selector buscable, preferir shadcn-svelte Combobox.
	 */
	import type { ComponentProps } from 'svelte';
	import Svelecte from 'svelecte';
	import { fade } from 'svelte/transition';

	type SvelecteProps = ComponentProps<typeof Svelecte>;
	type OptionRecord = Record<string, unknown>;
	type Options =
		Array<{ label: string; value: string | number }> | Array<{ name: string; id: string | number }>;

	type PropType = Omit<SvelecteProps, 'options'> & {
		options?: Options;
		error?: string[] | string | undefined;
	};

	let {
		value = $bindable(),
		listHeader: listHeaderPassed,
		createRow: createRowPassed,
		placeholder = 'Seleccionar',
		selection: selectionPassed,
		options = [],
		valueField = 'id',
		creatable,
		disabled,
		error,
		i18n,
		onChange,
		controlClass: _controlClass,
		dropdownClass: _dropdownClass,
		optionClass: _optionClass,
		class: _class,
		...rest
	}: PropType = $props();

	const i18nInternal = $derived({
		fetchEmpty: 'No hay coincidencias',
		fetchBefore: 'Escribe para buscar',
		...i18n
	});

	/**
	 * Svelecte warns and corrupts the binding when `value` is `''`, `null`,
	 * `undefined`, or anything that does not match an option's `valueField`.
	 * We translate those cases to `null` before handing it to Svelecte, and
	 * translate `null` back to `''` when propagating changes outward, so
	 * consumers can keep using the idiomatic "empty string = no selection".
	 */
	function isEmpty(v: unknown): boolean {
		return v === '' || v === null || v === undefined;
	}

	function getField(): string {
		return valueField ?? 'id';
	}

	function matchesOption(v: unknown): boolean {
		if (isEmpty(v)) return false;
		const field = getField();
		return (options as OptionRecord[]).some((opt) => opt?.[field] === v);
	}

	let svelecteValue = $state<string | number | null>(null);

	$effect(() => {
		const next = matchesOption(value) ? (value as string | number) : null;
		if (svelecteValue !== next) svelecteValue = next;
	});

	function handleChange(selected: unknown) {
		const field = getField();
		const nextValue =
			selected && typeof selected === 'object' && field in (selected as OptionRecord)
				? ((selected as OptionRecord)[field] as string | number)
				: '';
		if (value !== nextValue) value = nextValue;
		onChange?.(selected);
	}
</script>

<!-- These are the default snippets -->
{#snippet listHeader()}
	<p class="ml-2 cursor-default py-1 text-gray-400">
		Seleccionar {creatable && 'o escribe nueva'}
	</p>
{/snippet}

{#snippet createRow(_isCreating: boolean, inputValue: string, _: unknown)}
	<div
		title="Crear {inputValue}"
		class="group w-full cursor-pointer rounded bg-blue-100 p-1 hover:bg-blue-200"
	>
		<p class="w-full bg-blue-100 text-start group-hover:bg-blue-200">Crear: "{inputValue}"</p>
	</div>
{/snippet}

{#snippet selection(selectedOptions: unknown, _: unknown)}
	{#each selectedOptions as Options as option, i (`select-input-${i}`)}
		<div
			title={option.name ?? option.label}
			class={[
				'max-w-full truncate bg-primary-blue rounded-lg px-1 py-0.5',
				{ ' text-gray-600': disabled }
			]}
		>
			{#if 'id' in option}
				{option.name}
			{:else}
				{option.label}
			{/if}
		</div>
	{/each}
{/snippet}

<div class="">
	<Svelecte
		class={`sv-input${disabled ? ' sv-input-disabled' : ''}`}
		bind:value={svelecteValue}
		{options}
		{valueField}
		{disabled}
		{placeholder}
		{creatable}
		clearable
		onChange={handleChange}
		selection={selectionPassed ?? selection}
		listHeader={listHeaderPassed ?? listHeader}
		createRow={createRowPassed ?? createRow}
		i18n={i18nInternal}
		{...rest}
	/>
	{#if error !== undefined && error.length > 0}
		<span in:fade class="text-sm text-red-500">{typeof error === 'string' ? error : error[0]}</span>
	{/if}
</div>

<style>
	/* ── Svelecte CSS variables ───────────────────────────────────────── */
	:global(.sv-input) {
		--sv-bg: var(--color-surface-container-low);
		--sv-border: 1px solid transparent;
		--sv-border-radius: 0.5rem;
		--sv-min-height: 42px;
		--sv-placeholder-color: var(--color-outline);
		--sv-item-selected-bg: rgba(65, 158, 189, 0.1);
		--sv-highlight-bg: rgba(65, 158, 189, 0.15);
		--sv-dropdown-border: 1px solid var(--color-outline-variant);
		--sv-dropdown-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		--sv-dropdown-height: 280px;
		--sv-dropdown-active-bg: var(--color-surface-container-low);
		--sv-dropdown-selected-bg: rgba(65, 158, 189, 0.1);
	}

	/* ── Fixed height prevents layout shift on focus and on selection ─── */
	:global(.sv-input .sv-control) {
		height: 42px !important;
		cursor: pointer !important;
		transition:
			border-color 150ms,
			box-shadow 150ms !important;
	}

	/* ── Focus ring (box-shadow = no layout shift) ────────────────────── */
	:global(.sv-input .sv-control:focus-within) {
		border-color: rgba(65, 158, 189, 0.35) !important;
		box-shadow: 0 0 0 2px rgba(65, 158, 189, 0.15) !important;
		outline: none !important;
	}

	/* ── Prevent text wrapping in selected value ──────────────────────── */
	:global(.sv-item, .sv-item-selected) {
		overflow: hidden !important;
		text-overflow: ellipsis !important;
		white-space: nowrap !important;
		max-width: 100% !important;
	}

	/* ── Disabled ─────────────────────────────────────────────────────── */
	:global(.sv-input-disabled .sv-control) {
		cursor: not-allowed !important;
		opacity: 0.6 !important;
	}
</style>
