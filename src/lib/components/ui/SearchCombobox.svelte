<script lang="ts">
	import { Search, ChevronDown, X, Loader2 } from '@lucide/svelte';
	import { type Snippet, untrack } from 'svelte';

	type Props<T> = {
		options: T[];
		placeholder: string;
		disabled?: boolean;
		/** Show a loading spinner instead of "Sin resultados" while async search runs. */
		loading?: boolean;
		clearOnSelect?: boolean;
		value?: string;
		getId: (option: T) => string;
		getLabel: (option: T) => string;
		filterFn?: (query: string, option: T) => boolean;
		onselect: (option: T) => void;
		onclear?: () => void;
		/** Called with the raw query on every input — enables async/server search. */
		onquerychange?: (query: string) => void;
		children: Snippet<[{ option: T; highlighted: boolean; selected: boolean }]>;
	};

	let {
		options,
		placeholder,
		disabled = false,
		loading = false,
		clearOnSelect = false,
		value = '',
		getId,
		getLabel,
		filterFn,
		onselect,
		onclear,
		onquerychange,
		children
	}: Props<unknown> = $props();

	let query = $state('');
	let open = $state(false);
	let highlightedIdx = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();
	let skipNextSync = false;

	const filtered = $derived(
		query && filterFn ? options.filter((opt) => filterFn(query, opt)) : options
	);

	$effect(() => {
		if (skipNextSync) {
			skipNextSync = false;
			return;
		}
		if (value) {
			const selected = options.find((opt) => getId(opt) === value);
			if (selected) {
				const label = getLabel(selected);
				if (untrack(() => query) !== label) {
					query = label;
				}
			}
		}
	});

	function handleInput() {
		open = true;
		highlightedIdx = 0;
		onquerychange?.(query);
	}

	function handleSelect(option: unknown) {
		onselect(option);
		open = false;
		if (clearOnSelect) {
			skipNextSync = true;
			query = '';
		} else {
			query = getLabel(option);
		}
	}

	function handleClear() {
		onclear?.();
		query = '';
		open = false;
	}

	function handleFocus() {
		open = filtered.length > 0;
		highlightedIdx = 0;
	}

	function handleClick() {
		if (!open) {
			open = true;
			highlightedIdx = 0;
		}
	}

	function handleBlur() {
		setTimeout(() => (open = false), 150);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open && e.key === 'ArrowDown') {
			open = true;
			highlightedIdx = 0;
			return;
		}
		if (!open) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIdx = Math.min(highlightedIdx + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIdx = Math.max(highlightedIdx - 1, 0);
		} else if (e.key === 'Enter' && filtered[highlightedIdx]) {
			e.preventDefault();
			handleSelect(filtered[highlightedIdx]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="relative">
	<div class="relative">
		<Search
			class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
		/>
		<input
			bind:this={inputEl}
			type="text"
			bind:value={query}
			{placeholder}
			{disabled}
			role="combobox"
			aria-expanded={open}
			aria-haspopup="listbox"
			aria-controls="searchcombobox-list"
			oninput={handleInput}
			onfocus={handleFocus}
			onclick={handleClick}
			onblur={handleBlur}
			onkeydown={handleKeyDown}
			class="w-full rounded-lg border-none bg-surface-container-high px-3 py-2 pl-9 pr-14 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 {open
				? 'rounded-b-none'
				: ''}"
		/>
		<button
			type="button"
			onclick={() => (open = !open)}
			class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-outline hover:text-on-surface"
			tabindex="-1"
		>
			<ChevronDown class="h-4 w-4 transition-transform duration-150 {open ? 'rotate-180' : ''}" />
		</button>
		{#if onclear && query}
			<button
				type="button"
				onclick={handleClear}
				class="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-outline hover:text-error"
				tabindex="-1"
				aria-label="Limpiar búsqueda"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>

	{#if open && filtered.length > 0}
		<div
			class="absolute left-0 right-0 top-full z-50 max-h-60 overflow-y-auto rounded-b-lg border-x border-b border-outline-variant/20 bg-surface-container-lowest shadow-lg"
			role="listbox"
			id="searchcombobox-list"
		>
			{#each filtered as option, i (getId(option))}
				<button
					type="button"
					onclick={() => handleSelect(option)}
					onmousedown={(e) => e.preventDefault()}
					onmouseenter={() => (highlightedIdx = i)}
					class="flex w-full items-center cursor-pointer transition-colors hover:bg-surface-container-high {i ===
					highlightedIdx
						? 'bg-surface-container-high'
						: ''}"
					role="option"
					aria-selected={i === highlightedIdx}
				>
					{@render children({ option, highlighted: i === highlightedIdx, selected: false })}
				</button>
			{/each}
		</div>
	{:else if open && query}
		<div
			class="absolute left-0 right-0 top-full z-50 rounded-b-lg border-x border-b border-outline-variant/20 bg-surface-container-lowest px-3 py-4 text-center text-sm text-on-surface-variant shadow-lg"
		>
			{#if loading}
				<span class="inline-flex items-center gap-2">
					<Loader2 class="h-4 w-4 animate-spin" />
					Buscando...
				</span>
			{:else}
				Sin resultados
			{/if}
		</div>
	{/if}
</div>
