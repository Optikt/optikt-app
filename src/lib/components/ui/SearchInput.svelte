<script lang="ts">
	import { Search } from '@lucide/svelte';

	interface Props {
		value: string;
		placeholder?: string;
		class?: string;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(),
		placeholder = 'Buscar...',
		class: className = '',
		oninput
	}: Props = $props();
</script>

<div class={['relative', className]}>
	<Search class="absolute top-1/2 left-3 z-9999 h-4 w-4 -translate-y-1/2 text-gray-400" />
	<input
		type="search"
		{placeholder}
		bind:value
		{oninput}
		class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue pl-10 pr-4"
	/>
</div>
