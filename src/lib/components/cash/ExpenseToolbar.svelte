<script lang="ts">
	import { Download, Plus, Printer } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		ALL_EXPENSE_CATEGORIES,
		EXPENSE_CATEGORY_LABELS,
		type ExpenseCategory
	} from '$lib/shared/enums';

	interface Props {
		dateFrom: string;
		dateTo: string;
		categoryFilter: ExpenseCategory | '';
		includeVoided: boolean;
		loading: boolean;
		selectedCategoryLabel: string;
		onApply: () => void;
		onExport: () => void;
		onPrint: () => void;
		onCreate: () => void;
	}

	let {
		dateFrom = $bindable(),
		dateTo = $bindable(),
		categoryFilter = $bindable(),
		includeVoided = $bindable(),
		loading,
		selectedCategoryLabel,
		onApply,
		onExport,
		onPrint,
		onCreate
	}: Props = $props();

	const mobileLabelClass = 'text-[10px] font-semibold tracking-[0.18em] text-outline uppercase';
	const fieldInputClass =
		'w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const desktopToolbarInputClass =
		'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10';
</script>

<div
	class="mb-2 hidden flex-col gap-3 sm:mb-8 lg:flex lg:flex-row lg:items-center lg:justify-between"
>
	<div class="min-w-0">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">Egresos</h1>
		<p class="mt-1 max-w-3xl text-sm text-slate-500 sm:text-base">Gastos operativos del negocio.</p>
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
		<button
			type="button"
			onclick={onCreate}
			class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition hover:bg-brand-gold-dark sm:w-auto"
		>
			<Plus size={16} />
			Nuevo egreso
		</button>
	</div>
</div>

<div class="mb-4 lg:hidden">
	<div class="min-w-0">
		<h1 class="font-heading text-2xl font-bold tracking-[-0.03em] text-brand-navy">Egresos</h1>
		<p class="mt-0.5 text-[11px] text-on-surface-variant">
			Gestión de gastos operativos del negocio.
		</p>
	</div>

	<div class="mt-3 grid grid-cols-2 gap-2 print:hidden">
		<button
			type="button"
			onclick={onExport}
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-[11px] font-semibold text-brand-navy transition hover:bg-surface-container-high"
		>
			<Download size={14} />
			CSV
		</button>
		<button
			type="button"
			onclick={onPrint}
			class="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-[11px] font-semibold text-brand-navy transition hover:bg-surface-container-high"
		>
			<Printer size={14} />
			Impr.
		</button>
		<button
			type="button"
			onclick={onCreate}
			class="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition hover:bg-brand-gold-dark"
		>
			<Plus size={16} />
			Nuevo egreso
		</button>
	</div>

	<div class="mt-4 rounded-[1.25rem] bg-surface-container-lowest p-4 shadow-sm">
		<div class="grid grid-cols-2 gap-2">
			<label class="min-w-0">
				<span class={mobileLabelClass}>Desde</span>
				<input type="date" bind:value={dateFrom} class={`${fieldInputClass} mt-1`} />
			</label>
			<label class="min-w-0">
				<span class={mobileLabelClass}>Hasta</span>
				<input type="date" bind:value={dateTo} class={`${fieldInputClass} mt-1`} />
			</label>
		</div>

		<label class="mt-3 block min-w-0">
			<span class={mobileLabelClass}>Categoría</span>
			<select bind:value={categoryFilter} class={`${fieldInputClass} mt-1`}>
				<option value="">Todas</option>
				{#each ALL_EXPENSE_CATEGORIES as c (c)}
					<option value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
				{/each}
			</select>
		</label>

		<label
			class="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3"
		>
			<div>
				<p class={mobileLabelClass}>Anulados</p>
				<p class="mt-1 text-[11px] text-on-surface-variant">Mostrar egresos anulados en la lista</p>
			</div>
			<input
				type="checkbox"
				bind:checked={includeVoided}
				class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
			/>
		</label>

		<button
			type="button"
			onclick={onApply}
			disabled={loading}
			class="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
		>
			{loading ? 'Cargando...' : 'Aplicar filtros'}
		</button>
	</div>
</div>

<div
	class="mb-2 hidden items-center gap-3 text-sm text-slate-600 lg:flex lg:flex-wrap xl:flex-nowrap"
>
	<div class="flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm font-medium text-slate-500">Desde</span>
		<input type="date" bind:value={dateFrom} class={desktopToolbarInputClass} />
	</div>
	<div class="flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm font-medium text-slate-500">Hasta</span>
		<input type="date" bind:value={dateTo} class={desktopToolbarInputClass} />
	</div>
	<div class="flex items-center gap-2 whitespace-nowrap">
		<span class="text-sm font-medium text-slate-500">Categoría</span>
		<select bind:value={categoryFilter} class={desktopToolbarInputClass}>
			<option value="">Todas</option>
			{#each ALL_EXPENSE_CATEGORIES as c (c)}
				<option value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
			{/each}
		</select>
	</div>
	<label
		class="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm whitespace-nowrap text-slate-600"
	>
		<input
			type="checkbox"
			bind:checked={includeVoided}
			class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
		/>
		<span>Incluir anulados</span>
	</label>
	<button
		type="button"
		onclick={onApply}
		disabled={loading}
		class="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
	>
		{loading ? 'Cargando...' : 'Consultar'}
	</button>
</div>

<div class="mb-6 hidden lg:block">
	<p class="text-xs text-slate-500">
		Filtro activo:
		<span class="font-semibold text-slate-700">{selectedCategoryLabel}</span>
		· {dateFrom} a {dateTo}
		{includeVoided ? ' · Incluye anulados' : ''}
	</p>
</div>
