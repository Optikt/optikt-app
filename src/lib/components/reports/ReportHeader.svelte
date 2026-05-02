<script lang="ts">
	import { Download, Printer } from '@lucide/svelte';
	import { Button } from 'flowbite-svelte';

	let {
		title,
		subtitle,
		onExportCsv,
		onPrint
	}: {
		title: string;
		subtitle?: string;
		onExportCsv?: () => void;
		onPrint?: () => void;
	} = $props();
</script>

<div class="mb-2 flex flex-col gap-3 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
	<div class="flex items-start gap-3">
		<!-- <a
			href={resolve('/reports')}
			class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 print:hidden"
		>
			<ArrowLeft class="h-5 w-5" />
		</a> -->
		<div class="min-w-0">
			<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
			{#if subtitle}
				<p class="mt-1 max-w-3xl text-sm text-slate-500 sm:text-base">{subtitle}</p>
			{/if}
		</div>
	</div>
	<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row print:hidden">
		{#if onExportCsv}
			<Button
				color="alternative"
				size="sm"
				class="w-full justify-center px-3 sm:w-auto"
				onclick={onExportCsv}
			>
				<Download class="mr-2 h-4 w-4" />
				<span class="sm:hidden">CSV</span>
				<span class="hidden sm:inline">Exportar CSV</span>
			</Button>
		{/if}
		{#if onPrint}
			<Button
				color="alternative"
				size="sm"
				class="w-full justify-center px-3 sm:w-auto"
				onclick={onPrint}
			>
				<Printer class="mr-2 h-4 w-4" />
				<span class="sm:hidden">Impr.</span>
				<span class="hidden sm:inline">Imprimir</span>
			</Button>
		{/if}
	</div>
</div>
