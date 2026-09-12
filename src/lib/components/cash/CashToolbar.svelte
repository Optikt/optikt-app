<script lang="ts">
	import { ArrowRight, Download, Printer } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { formatPrice } from '$lib/utils';
	import {
		desktopLabelClass,
		desktopToolbarInputClass,
		mobileInputClass,
		mobileLabelClass,
		mobileSurfaceClass
	} from './cashClasses';

	interface Props {
		dateFrom: string;
		dateTo: string;
		loading: boolean;
		totalCollected: number;
		netProfit: number;
		onApply: () => void;
		onExport: () => void;
		onPrint: () => void;
	}

	let {
		dateFrom = $bindable(),
		dateTo = $bindable(),
		loading,
		totalCollected,
		netProfit,
		onApply,
		onExport,
		onPrint
	}: Props = $props();
</script>

<div
	class="mb-2 hidden flex-col gap-3 sm:mb-8 lg:flex lg:flex-row lg:items-center lg:justify-between"
>
	<div class="min-w-0">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">Caja y P&amp;L</h1>
		<p class="mt-1 max-w-3xl text-sm text-slate-500 sm:text-base">
			Caja, utilidad y pipeline operativo en una sola vista.
		</p>
	</div>
	<div class="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-row print:hidden">
		<Button
			color="alternative"
			size="sm"
			class="w-full justify-center px-3 sm:w-auto"
			onclick={onExport}
		>
			<Download class="mr-2 h-4 w-4" />
			<span class="sm:hidden">CSV</span>
			<span class="hidden sm:inline">Exportar CSV</span>
		</Button>
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
		<a
			href={resolve('/cash/expenses')}
			class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-gold-dark sm:w-auto"
		>
			Gestionar egresos
			<ArrowRight size={16} />
		</a>
	</div>
</div>

<div class="mb-4 lg:hidden">
	<div class="mb-3 flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h1 class="font-heading text-2xl font-bold tracking-[-0.03em] text-brand-navy">
				Caja y P&amp;L
			</h1>
		</div>
		<a
			href={resolve('/cash/expenses')}
			class="inline-flex shrink-0 items-center gap-1 rounded-xl bg-surface-container-low px-3 py-2 text-[11px] font-semibold text-brand-navy transition hover:bg-surface-container-high"
		>
			Gestionar egresos
			<ArrowRight size={12} />
		</a>
	</div>

	<div class={`${mobileSurfaceClass} p-4`}>
		<div class="grid grid-cols-2 gap-2">
			<label class="min-w-0">
				<span class={mobileLabelClass}>Desde</span>
				<input type="date" bind:value={dateFrom} class={mobileInputClass} />
			</label>
			<label class="min-w-0">
				<span class={mobileLabelClass}>Hasta</span>
				<input type="date" bind:value={dateTo} class={mobileInputClass} />
			</label>
		</div>

		<button
			type="button"
			onclick={onApply}
			disabled={loading}
			class="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
		>
			{loading ? 'Cargando...' : 'Consultar'}
		</button>
	</div>
</div>

<div
	class="mb-6 hidden items-center gap-3 text-sm text-slate-600 lg:flex lg:flex-wrap xl:flex-nowrap"
>
	<span class={desktopLabelClass}>Período:</span>
	<div class="flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm font-medium text-slate-500">Desde</span>
		<input type="date" bind:value={dateFrom} class={desktopToolbarInputClass} />
	</div>
	<div class="flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm font-medium text-slate-500">Hasta</span>
		<input type="date" bind:value={dateTo} class={desktopToolbarInputClass} />
	</div>
	<button
		type="button"
		onclick={onApply}
		disabled={loading}
		class="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
	>
		{loading ? 'Cargando...' : 'Consultar'}
	</button>
	<div class="h-7 w-px shrink-0 bg-slate-200"></div>
	<div class="inline-flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm text-slate-500">Cobrado en caja:</span>
		<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
			{formatPrice(totalCollected)}
		</span>
	</div>
	<div class="inline-flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm text-slate-500">Utilidad neta:</span>
		<span
			class="font-mono text-sm font-semibold tabular-nums {netProfit >= 0
				? 'text-emerald-700'
				: 'text-rose-700'}"
		>
			{formatPrice(netProfit)}
		</span>
	</div>
</div>
