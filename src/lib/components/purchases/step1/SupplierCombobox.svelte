<script lang="ts">
	import SearchCombobox from '$lib/components/ui/SearchCombobox.svelte';

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

	const sorted = $derived([...suppliers].sort((a, b) => a.name.localeCompare(b.name)));
</script>

<SearchCombobox
	options={sorted}
	placeholder="Buscar proveedor..."
	{disabled}
	getId={(s: unknown) => (s as SupplierOption).id}
	getLabel={(s: unknown) => (s as SupplierOption).name}
	filterFn={(query: string, s: unknown) =>
		(s as SupplierOption).name.toLowerCase().includes(query.toLowerCase())}
	onselect={(s: unknown) => {
		value = (s as SupplierOption).id;
	}}
	onclear={() => {
		value = '';
	}}
>
	{#snippet children(opt)}
		<span class="block w-full px-3 py-2 text-left text-sm text-on-surface">
			{(opt.option as SupplierOption).name}
		</span>
	{/snippet}
</SearchCombobox>
