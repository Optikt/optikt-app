<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Svelecte from 'svelecte';
	import { fade } from 'svelte/transition';

	type SvelecteProps = ComponentProps<typeof Svelecte>;
	type OptionRecord = Record<string, unknown>;
	type Options =
		| Array<{ label: string; value: string | number }>
		| Array<{ name: string; id: string | number }>;

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
		...rest
	}: PropType = $props();

	const i18nInternal = $derived({
		fetchEmpty: 'No hay coincidencias',
		fetchBefore: 'Escribe para buscar',
		...i18n
	});

	const controlClass =
		'focus-within:!ring-dark-blue !rounded-lg !border !py-[2.5px] !px-2 focus-within:!outline-hidden focus-within:!ring-1 !ring-1 !ring-transparent !border-r-8 !border-transparent';

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
			class={['bg-primary-blue rounded-lg px-1 py-0.5', { ' text-gray-600': disabled }]}
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
		class="base-select"
		controlClass={`${controlClass} ${disabled ? '!cursor-not-allowed !bg-gray-200' : '!cursor-pointer !bg-secondary-blue/30'}`}
		dropdownClass="!rounded-lg !border !p-[1px] !bg-[#d9f2f8]"
		optionClass="!rounded !bg-[#d9f2f8] hover:!bg-[#BFD6DB] hover:cursor-pointer"
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