<script lang="ts">
	import { X } from '@lucide/svelte';

	interface OptionItem {
		id: string;
		name: string;
		subtext?: string;
	}

	interface Tag {
		key: string;
		label: string;
	}

	interface Props {
		options: OptionItem[];
		/** Etiquetas activas (controladas por el padre). */
		value: Tag[];
		placeholder: string;
		disabled?: boolean;
		/** Texto de la acción de pie (crea nueva entrada: «Agregar como persona externa»). */
		createLabel?: string;
		/** Variante por etiqueta ('navy' por defecto, 'warning' para externos). */
		tagVariants?: Record<string, 'navy' | 'warning'>;
		onchange: (tags: Tag[]) => void;
		oncreate?: (name: string) => void;
	}

	let {
		options,
		value = $bindable(),
		placeholder,
		disabled = false,
		createLabel,
		tagVariants = {},
		onchange,
		oncreate
	}: Props = $props();
	const listboxId = $props.id();

	let search = $state('');
	let open = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();
	let root: HTMLDivElement | undefined = $state();
	let highlighted = $state(0);

	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(
		options.filter(
			(option) =>
				(!query || option.name.toLowerCase().includes(query)) &&
				!value.some((tag) => tag.key === option.id)
		)
	);
	const availableCreate = $derived(
		Boolean(createLabel && query && !options.some((o) => o.name.toLowerCase() === query))
	);

	// Cierra el dropdown al hacer clic fuera del control (los overlays nativos
	// no se cierran solos y se superponen a otros campos del formulario).
	$effect(() => {
		if (!open || disabled) return;
		function onPointerDown(event: PointerEvent): void {
			if (!root) return;
			if (event.target instanceof Node && !root.contains(event.target)) {
				open = false;
			}
		}
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	});

	function commit(next: Tag[]): void {
		value = next;
		onchange?.(next);
	}

	function select(option: { id: string; name: string }): void {
		commit([...value, { key: option.id, label: option.name }]);
		search = '';
		// El dropdown permanece abierto tras elegir (selección múltiple).
		open = true;
		highlighted = 0;
	}

	function remove(tag: Tag): void {
		commit(value.filter((item) => item.key !== tag.key));
	}

	function removeLast(): void {
		if (!search) commit(value.slice(0, -1));
	}

	function createOption(): void {
		if (!oncreate || !query) return;
		oncreate(search.trim());
		search = '';
	}

	function clearSearch(): void {
		search = '';
		open = false;
		inputEl?.focus();
	}

	function keydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			open = true;
			highlighted = Math.min(highlighted + 1, Math.max(filtered.length - 1, 0));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (availableCreate) createOption();
			else if (filtered[highlighted]) select(filtered[highlighted]!);
		} else if (event.key === 'Backspace' && !search) {
			event.preventDefault();
			removeLast();
		} else if (event.key === 'Escape') {
			event.stopPropagation();
			open = false;
		}
	}

	function openDropdown(): void {
		if (disabled) return;
		open = true;
	}
</script>

<div
	class="relative"
	bind:this={root}
	onclick={() => inputEl?.focus()}
	onfocusin={openDropdown}
	role="presentation"
>
	<div
		class={`relative flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-lg border border-outline-variant/35 bg-white px-1.5 py-1.5 ${open ? 'ring-2 ring-brand-blue/30' : ''}`}
	>
		{#each value as tag (tag.key)}
			<span
				class={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
					tagVariants[tag.key] === 'warning'
						? 'bg-warning-container text-on-warning-container'
						: 'bg-brand-navy text-white'
				}`}
			>
				{tag.label}
				<button
					type="button"
					tabindex="-1"
					aria-label={`Quitar ${tag.label}`}
					class="opacity-70 transition-opacity hover:opacity-100"
					onclick={() => remove(tag)}
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</span>
		{/each}
		<input
			bind:this={inputEl}
			bind:value={search}
			{placeholder}
			{disabled}
			autocomplete="off"
			role="combobox"
			aria-expanded={open}
			aria-controls={listboxId}
			aria-haspopup="listbox"
			aria-autocomplete="list"
			class="min-w-[140px] flex-1 border-0 bg-transparent p-1 pr-6 text-sm text-on-surface outline-none"
			oninput={() => {
				open = true;
				highlighted = 0;
			}}
			onkeydown={keydown}
		/>
		{#if search || open}
			<button
				type="button"
				aria-label="Limpiar y cerrar"
				class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-brand-navy"
				onclick={clearSearch}
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}
	</div>

	{#if open && !disabled}
		<ul
			id={listboxId}
			role="listbox"
			aria-multiselectable="true"
			class="absolute top-[calc(100%+4px)] z-50 max-h-60 w-full overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 shadow-brand-navy/25 ring-outline-variant/30"
		>
			{#each filtered as option, index (option.id)}
				<li role="option" aria-selected="false">
					<button
						type="button"
						tabindex="-1"
						class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors {index ===
						highlighted
							? 'bg-surface-container-low'
							: 'hover:bg-surface-container-low'}"
						onclick={() => select(option)}
					>
						<span
							class="flex h-4 w-4 items-center justify-center rounded border border-outline-variant"
						></span>
						<span class="flex-1 truncate">{option.name}</span>
						{#if option.subtext}
							<span class="text-xs text-on-surface-variant">{option.subtext}</span>
						{/if}
					</button>
				</li>
			{/each}
			{#if availableCreate}
				<li>
					<button
						type="button"
						tabindex="-1"
						class="flex w-full items-center px-3 py-2 text-left text-sm font-semibold text-brand-navy hover:bg-surface-container-low"
						onclick={createOption}
					>
						＋ {createLabel} «{search.trim()}»
					</button>
				</li>
			{/if}
			{#if filtered.length === 0 && !availableCreate}
				<li class="px-3 py-2 text-sm text-on-surface-variant">Sin resultados</li>
			{/if}
		</ul>
	{/if}
</div>

<style>
	input::placeholder {
		color: #9ca3af;
	}
</style>
