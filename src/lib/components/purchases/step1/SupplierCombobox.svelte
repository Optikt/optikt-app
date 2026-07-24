<script lang="ts">
	import { ChevronDown, Search, X } from '@lucide/svelte';
	import { inputClass } from '../purchaseFieldStyles';

	type SupplierOption = {
		id: string;
		name: string;
	};

	interface Props {
		suppliers: SupplierOption[];
		value: string;
		disabled?: boolean;
	}

	let { suppliers, value = $bindable(), disabled = false }: Props = $props();

	let inputValue = $state('');
	let open = $state(false);

	const sorted = $derived([...suppliers].sort((a, b) => a.name.localeCompare(b.name)));
	const selectedLabel = $derived(sorted.find((s) => s.id === value)?.name ?? '');

	const filtered = $derived(
		sorted.filter((s) => s.name.toLowerCase().includes(inputValue.toLowerCase()))
	);

	function handleInput(e: Event) {
		inputValue = (e.target as HTMLInputElement).value;
		open = true;
	}

	function handleSelect(supplierId: string) {
		value = supplierId;
		const selected = sorted.find((s) => s.id === supplierId);
		inputValue = selected?.name ?? '';
		open = false;
	}

	function handleFocus() {
		if (value) inputValue = selectedLabel;
		open = filtered.length > 0;
	}

	function handleBlur() {
		setTimeout(() => (open = false), 150);
	}

	function handleClear() {
		value = '';
		inputValue = '';
	}
</script>

<div class="relative">
	<div class="relative">
		<Search
			class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline"
		/>
		<input
			type="text"
			value={inputValue || selectedLabel}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			placeholder="Buscar proveedor..."
			{disabled}
			role="combobox"
			aria-expanded={open}
			aria-controls="supplier-listbox"
			class={[inputClass, 'pl-9 pr-14', open ? 'rounded-b-none' : '']}
		/>
		<button
			type="button"
			onclick={() => (open = !open)}
			class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-outline hover:text-on-surface"
			tabindex="-1"
		>
			<ChevronDown class="h-4 w-4 transition-transform duration-150 {open ? 'rotate-180' : ''}" />
		</button>
		{#if value && !disabled}
			<button
				type="button"
				onclick={handleClear}
				class="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-outline hover:text-error"
				tabindex="-1"
				aria-label="Deseleccionar proveedor"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>

	{#if open && filtered.length > 0}
		<div
			class="absolute left-0 right-0 top-full z-50 max-h-60 overflow-y-auto rounded-b-lg border-x border-b border-outline-variant/20 bg-surface-container-lowest shadow-lg"
			role="listbox"
			id="supplier-listbox"
		>
			{#each filtered as supplier (supplier.id)}
				<button
					type="button"
					onclick={() => handleSelect(supplier.id)}
					onmousedown={(e) => e.preventDefault()}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-high {supplier.id ===
					value
						? 'bg-surface-container-high font-semibold text-brand-navy'
						: ''}"
					role="option"
					aria-selected={supplier.id === value}
				>
					<span class="truncate">{supplier.name}</span>
				</button>
			{/each}
		</div>
	{:else if open}
		<div
			class="absolute left-0 right-0 top-full z-50 rounded-b-lg border-x border-b border-outline-variant/20 bg-surface-container-lowest px-3 py-4 text-center text-sm text-on-surface-variant shadow-lg"
			id="supplier-listbox"
		>
			Sin resultados
		</div>
	{/if}
</div>
