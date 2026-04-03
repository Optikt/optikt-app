<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { Search } from '@lucide/svelte';

	let {
		dateFrom = $bindable(),
		dateTo = $bindable(),
		loading = false,
		onApply
	}: {
		dateFrom: string;
		dateTo: string;
		loading?: boolean;
		onApply: () => void;
	} = $props();
</script>

<div
	class="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"
>
	<div class="flex flex-col gap-1">
		<label for="dateFrom" class="text-sm font-medium text-slate-700">Desde</label>
		<input
			id="dateFrom"
			type="date"
			bind:value={dateFrom}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
		/>
	</div>
	<div class="flex flex-col gap-1">
		<label for="dateTo" class="text-sm font-medium text-slate-700">Hasta</label>
		<input
			id="dateTo"
			type="date"
			bind:value={dateTo}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
		/>
	</div>
	<Button color="blue" size="sm" onclick={onApply} disabled={loading}>
		<Search class="mr-2 h-4 w-4" />
		{loading ? 'Cargando...' : 'Consultar'}
	</Button>
</div>
