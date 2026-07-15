<script lang="ts">
	import { Button } from '$lib/components/ui/button';
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
	class="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:mb-6 sm:flex sm:flex-wrap sm:items-end sm:gap-4 sm:p-5 print:hidden"
>
	<div class="min-w-0 sm:min-w-[10.5rem]">
		<label for="dateFrom" class="text-xs font-medium text-slate-700 sm:text-sm">Desde</label>
		<input
			id="dateFrom"
			type="date"
			bind:value={dateFrom}
			class="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
		/>
	</div>
	<div class="min-w-0 sm:min-w-[10.5rem]">
		<label for="dateTo" class="text-xs font-medium text-slate-700 sm:text-sm">Hasta</label>
		<input
			id="dateTo"
			type="date"
			bind:value={dateTo}
			class="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
		/>
	</div>
	<Button
		color="blue"
		size="sm"
		class="col-span-2 w-full justify-center px-3 sm:w-auto"
		onclick={onApply}
		disabled={loading}
	>
		<Search class="mr-2 h-4 w-4" />
		{loading ? 'Cargando...' : 'Consultar'}
	</Button>
</div>
