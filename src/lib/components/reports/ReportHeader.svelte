<script lang="ts">
	import { Download, Printer, ArrowLeft } from '@lucide/svelte';
	import { Button } from 'flowbite-svelte';
	import { resolve } from '$app/paths';

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

<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
	<div class="flex items-center gap-3">
		<a
			href={resolve('/reports')}
			class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 print:hidden"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
			{#if subtitle}
				<p class="mt-1 text-base text-slate-500">{subtitle}</p>
			{/if}
		</div>
	</div>
	<div class="flex gap-2 print:hidden">
		{#if onExportCsv}
			<Button color="alternative" size="sm" onclick={onExportCsv}>
				<Download class="mr-2 h-4 w-4" />
				Exportar CSV
			</Button>
		{/if}
		{#if onPrint}
			<Button color="alternative" size="sm" onclick={onPrint}>
				<Printer class="mr-2 h-4 w-4" />
				Imprimir
			</Button>
		{/if}
	</div>
</div>
