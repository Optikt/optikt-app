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
	<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
	<input
		type="search"
		{placeholder}
		bind:value
		{oninput}
		class="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-blue-500 focus:ring-blue-500"
	/>
</div>
