<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Plus, Ban, Download, Printer, X } from '@lucide/svelte';
	import { formatPrice, formatDateOnly, downloadCsv, getErrorMessage } from '$lib/utils';
	import {
		ALL_EXPENSE_CATEGORIES,
		ALL_EXPENSE_CURRENCIES,
		ALL_RATE_TYPES,
		EXPENSE_CATEGORY_LABELS,
		EXPENSE_CURRENCY_LABELS,
		RATE_TYPE_LABELS,
		type ExpenseCategory,
		type ExpenseCurrency,
		type RateType
	} from '$lib/shared/enums';
	import {
		calculateExpenseAmountBcvUsd,
		getExpenseExchangeRateLabel,
		requiresExpenseExchangeRate,
		requiresExpenseRateType
	} from '$lib/shared/expenseCalculations';
	import {
		listExpensesQuery,
		createExpenseCommand,
		voidExpenseCommand
	} from '$lib/remote/cash.remote';
	import { fetchLatestRates } from '$lib/remote/exchangeRates.remote';
	import type { ExpenseListRow } from '$lib/server/db/queries/cash';

	let { data } = $props();
	const initial = untrack(() => data);

	let expenses = $state<ExpenseListRow[]>(initial.expenses);
	let dateFrom = $state(initial.dateFrom);
	let dateTo = $state(initial.dateTo);
	let categoryFilter = $state<ExpenseCategory | ''>('');
	let includeVoided = $state(false);
	let loading = $state(false);

	// Modal
	let showCreate = $state(false);
	let creating = $state(false);
	let form = $state(emptyForm());
	let bcvRateHint = $state<number | null>(null);
	let usdtRateHint = $state<number | null>(null);

	function emptyForm() {
		const today = new Date().toISOString().slice(0, 10);
		return {
			category: 'OTHER' as ExpenseCategory,
			description: '',
			currency: 'USD' as ExpenseCurrency,
			amount: '' as string,
			bcvRate: '' as string,
			exchangeRate: '' as string,
			rateType: 'BCV' as RateType,
			expenseDate: today,
			reference: '',
			notes: ''
		};
	}

	async function applyFilter() {
		loading = true;
		try {
			expenses = await listExpensesQuery({
				from: dateFrom,
				to: dateTo,
				category: categoryFilter || undefined,
				includeVoided
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando egresos'));
		} finally {
			loading = false;
		}
	}

	async function openCreate() {
		form = emptyForm();
		showCreate = true;
		bcvRateHint = null;
		usdtRateHint = null;
		// Pre-fill BCV rate
		try {
			const rates = await fetchLatestRates();
			const usd = rates.find((r) => r.currency.code === 'USD');
			const usdt = rates.find((r) => r.id === 'usdt');
			if (usd) {
				bcvRateHint = usd.rateToVes;
				form.bcvRate = usd.rateToVes.toFixed(2);
			}
			if (usdt) {
				usdtRateHint = usdt.rateToVes;
			}
		} catch {
			bcvRateHint = null;
			usdtRateHint = null;
		}
	}

	function closeCreate() {
		showCreate = false;
	}

	const needsExchangeRate = $derived(requiresExpenseExchangeRate(form.currency));
	const needsRateType = $derived(requiresExpenseRateType(form.currency));
	const exchangeRateLabel = $derived(getExpenseExchangeRateLabel(form.currency));
	const normalizedAmountPreview = $derived.by(() => {
		const amount = Number(form.amount);
		const bcvRate = Number(form.bcvRate);
		const exchangeRate = Number(form.exchangeRate);

		return calculateExpenseAmountBcvUsd({
			currency: form.currency,
			amount: Number.isFinite(amount) ? amount : 0,
			bcvRate: Number.isFinite(bcvRate) ? bcvRate : 0,
			exchangeRate: Number.isFinite(exchangeRate) ? exchangeRate : undefined
		});
	});

	async function submitCreate(ev: SubmitEvent) {
		ev.preventDefault();
		creating = true;
		try {
			const amount = Number(form.amount);
			const bcvRate = Number(form.bcvRate);
			const exchangeRate = needsExchangeRate ? Number(form.exchangeRate) : undefined;
			if (Number.isNaN(amount) || amount <= 0) {
				toast.error('Monto inválido');
				return;
			}
			if (Number.isNaN(bcvRate) || bcvRate <= 0) {
				toast.error('Tasa BCV inválida');
				return;
			}
			if (
				needsExchangeRate &&
				(Number.isNaN(exchangeRate ?? Number.NaN) || (exchangeRate ?? 0) <= 0)
			) {
				toast.error('Tasa inválida');
				return;
			}
			const isoDate = `${form.expenseDate}T12:00:00.000Z`;
			await createExpenseCommand({
				category: form.category,
				description: form.description.trim(),
				currency: form.currency,
				amount,
				exchangeRate,
				bcvRate,
				rateType: needsRateType ? form.rateType : undefined,
				expenseDate: isoDate,
				reference: form.reference.trim() || undefined,
				notes: form.notes.trim() || undefined
			});
			toast.success('Egreso registrado');
			showCreate = false;
			await applyFilter();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error registrando egreso'));
		} finally {
			creating = false;
		}
	}

	async function handleVoid(row: ExpenseListRow) {
		const reason = window.prompt(`Motivo de anulación para "${row.description}":`);
		if (!reason) return;
		if (reason.trim().length < 5) {
			toast.error('Motivo mínimo 5 caracteres');
			return;
		}
		try {
			await voidExpenseCommand({ id: row.id, voidReason: reason.trim() });
			toast.success('Egreso anulado');
			await applyFilter();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error anulando egreso'));
		}
	}

	function handleExportCsv() {
		const headers = [
			'Fecha',
			'Categoría',
			'Descripción',
			'Moneda',
			'Monto',
			'Equivalente USD BCV',
			'Tasa operativa',
			'Tasa BCV',
			'Registrado por',
			'Referencia',
			'Estado'
		];
		const rows = expenses.map((e) => [
			formatDateOnly(e.expenseDate, { dateStyle: 'short' }),
			EXPENSE_CATEGORY_LABELS[e.category],
			e.description,
			e.currency,
			e.amount.toFixed(2),
			e.amountUsd.toFixed(2),
			e.exchangeRate?.toFixed(4) ?? '',
			e.bcvRate?.toFixed(4) ?? '',
			e.registeredByName ?? '',
			e.reference ?? '',
			e.voidedAt ? 'ANULADO' : 'Activo'
		]);
		downloadCsv(`egresos-${dateFrom}-a-${dateTo}.csv`, headers, rows);
	}

	function handlePrint() {
		window.print();
	}

	const activeCount = $derived(expenses.filter((e) => !e.voidedAt).length);
	const total = $derived(expenses.filter((e) => !e.voidedAt).reduce((s, e) => s + e.amountUsd, 0));
	const selectedCategoryLabel = $derived(
		categoryFilter ? EXPENSE_CATEGORY_LABELS[categoryFilter] : 'Todas'
	);
	const mobileLabelClass = 'text-[10px] font-semibold tracking-[0.18em] text-outline uppercase';
	const mobileMetaClass = 'mt-1 text-[11px] text-on-surface-variant';
	const mobileSurfaceClass = 'rounded-[1.25rem] bg-surface-container-lowest shadow-sm';
	const mobileInsetClass = 'rounded-xl bg-surface-container-low px-3 py-3';
	const fieldInputClass =
		'w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const desktopToolbarInputClass =
		'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10';
	const desktopLabelClass = 'text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase';
	const desktopValueClass = 'mt-2 font-mono text-[1.6rem] font-semibold leading-none tabular-nums';
</script>

<svelte:head>
	<title>Egresos - Caja - Optikt</title>
</svelte:head>

<div class="px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<div
		class="mb-2 hidden flex-col gap-3 sm:mb-8 lg:flex lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="min-w-0">
			<h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">Egresos</h1>
			<p class="mt-1 max-w-3xl text-sm text-slate-500 sm:text-base">
				Gastos operativos del negocio.
			</p>
		</div>
		<div class="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-row print:hidden">
			<Button
				color="alternative"
				size="sm"
				class="w-full justify-center px-3 sm:w-auto"
				onclick={handleExportCsv}
			>
				<Download class="mr-2 h-4 w-4" />
				<span class="sm:hidden">CSV</span>
				<span class="hidden sm:inline">Exportar CSV</span>
			</Button>
			<Button
				color="alternative"
				size="sm"
				class="w-full justify-center px-3 sm:w-auto"
				onclick={handlePrint}
			>
				<Printer class="mr-2 h-4 w-4" />
				<span class="sm:hidden">Impr.</span>
				<span class="hidden sm:inline">Imprimir</span>
			</Button>
			<button
				type="button"
				onclick={openCreate}
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
				onclick={handleExportCsv}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-[11px] font-semibold text-brand-navy transition hover:bg-surface-container-high"
			>
				<Download size={14} />
				CSV
			</button>
			<button
				type="button"
				onclick={handlePrint}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-[11px] font-semibold text-brand-navy transition hover:bg-surface-container-high"
			>
				<Printer size={14} />
				Impr.
			</button>
			<button
				type="button"
				onclick={openCreate}
				class="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition hover:bg-brand-gold-dark"
			>
				<Plus size={16} />
				Nuevo egreso
			</button>
		</div>

		<div class={`${mobileSurfaceClass} mt-4 p-4`}>
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
					<p class="mt-1 text-[11px] text-on-surface-variant">
						Mostrar egresos anulados en la lista
					</p>
				</div>
				<input
					type="checkbox"
					bind:checked={includeVoided}
					class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
				/>
			</label>

			<button
				type="button"
				onclick={applyFilter}
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
			onclick={applyFilter}
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

	<!-- Summary -->
	<div class="mb-5 grid grid-cols-2 gap-2 lg:hidden">
		<div class={`${mobileInsetClass}`}>
			<p class={mobileLabelClass}>Total activo USD</p>
			<p class="mt-1 font-mono text-[17px] font-semibold text-rose-700 tabular-nums">
				{formatPrice(total)}
			</p>
			<p class={mobileMetaClass}>Solo egresos no anulados</p>
		</div>
		<div class={`${mobileInsetClass}`}>
			<p class={mobileLabelClass}>Cantidad activa</p>
			<p class="mt-1 font-mono text-[17px] font-semibold text-brand-navy tabular-nums">
				{activeCount}
			</p>
			<p class={mobileMetaClass}>
				{includeVoided ? `${expenses.length} visibles` : 'Vista limpia de activos'}
			</p>
		</div>
	</div>

	<div class="mb-6 hidden lg:block">
		<div class="glass-card overflow-hidden">
			<div class="grid items-stretch gap-px bg-slate-200 lg:grid-cols-[15rem_13rem_minmax(0,1fr)]">
				<div class="flex h-full flex-col bg-white px-4 py-4">
					<p class={desktopLabelClass}>Total activo USD</p>
					<p class={`${desktopValueClass} text-rose-700`}>{formatPrice(total)}</p>
					<p class="mt-2 text-xs text-slate-500">Solo egresos no anulados</p>
				</div>
				<div class="flex h-full flex-col bg-white px-4 py-4">
					<p class={desktopLabelClass}>Cantidad activa</p>
					<p class={`${desktopValueClass} text-brand-navy`}>{activeCount}</p>
					<p class="mt-2 text-xs text-slate-500">
						{includeVoided ? `${expenses.length} visibles` : 'Vista limpia de activos'}
					</p>
				</div>
				<div class="flex h-full flex-col bg-white px-4 py-4">
					<p class={desktopLabelClass}>Categoría activa</p>
					<p class="mt-2 text-base font-semibold text-brand-navy">{selectedCategoryLabel}</p>
					<p class="mt-2 text-xs text-slate-500">{dateFrom} a {dateTo}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="lg:hidden">
		<div class={`${mobileSurfaceClass} p-4`}>
			<div class="mb-3 flex items-start justify-between gap-3">
				<div>
					<h2 class="text-base font-semibold tracking-[-0.02em] text-brand-navy">Movimientos</h2>
					<p class="mt-1 text-[11px] text-on-surface-variant">
						Lista compacta de egresos registrados en el período.
					</p>
				</div>
				<span
					class="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-brand-navy uppercase"
				>
					{expenses.length} item{expenses.length === 1 ? '' : 's'}
				</span>
			</div>

			{#if expenses.length === 0}
				<div
					class="rounded-xl bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant"
				>
					Sin egresos en el período seleccionado
				</div>
			{:else}
				<div class="space-y-3">
					{#each expenses as row (row.id)}
						<article class="rounded-[1.25rem] bg-surface-container-low px-3 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span
											class="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-brand-navy uppercase"
										>
											{EXPENSE_CATEGORY_LABELS[row.category]}
										</span>
										{#if row.voidedAt}
											<span
												class="inline-flex items-center rounded-full bg-error-container px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-on-error-container uppercase"
											>
												Anulado
											</span>
										{/if}
									</div>

									<p
										class="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-brand-navy {row.voidedAt
											? 'line-through decoration-rose-300'
											: ''}"
									>
										{row.description}
									</p>
									<p class="mt-1 text-[11px] text-on-surface-variant">
										{formatDateOnly(row.expenseDate, { dateStyle: 'medium' })}
										· Registró {row.registeredByName ?? '-'}
									</p>
									{#if row.reference}
										<p class="mt-1 text-[11px] text-on-surface-variant">Ref. {row.reference}</p>
									{/if}
									{#if row.voidedAt}
										<p class="mt-2 text-[11px] font-medium text-rose-700">
											Motivo: {row.voidReason}
										</p>
									{/if}
								</div>

								<div
									class="min-w-[7.75rem] rounded-xl bg-surface-container-lowest px-3 py-3 text-right"
								>
									<p class={mobileLabelClass}>Monto</p>
									<p class="mt-1 font-mono text-[13px] font-semibold text-brand-navy tabular-nums">
										{row.amount.toFixed(2)}
										{row.currency}
									</p>
									<p
										class="mt-2 text-[10px] font-semibold tracking-[0.18em] text-outline uppercase"
									>
										USD BCV
									</p>
									<p class="mt-1 font-mono text-[13px] font-semibold text-brand-navy tabular-nums">
										{formatPrice(row.amountUsd)}
									</p>
									{#if row.exchangeRate}
										<p class="mt-1 text-[10px] text-on-surface-variant">
											{row.currency === 'USDT' ? 'USDT' : 'Op.'}
											{row.exchangeRate.toFixed(2)}
										</p>
									{/if}
									{#if row.bcvRate}
										<p class="mt-1 text-[10px] text-on-surface-variant">
											BCV {row.bcvRate.toFixed(2)}
										</p>
									{/if}
								</div>
							</div>

							{#if !row.voidedAt}
								<div class="mt-3 flex justify-end border-t border-surface-container-high pt-3">
									<button
										type="button"
										onclick={() => handleVoid(row)}
										class="inline-flex items-center gap-1 rounded-xl bg-error-container px-3 py-2 text-[11px] font-semibold text-on-error-container transition hover:opacity-90"
										aria-label="Anular egreso"
									>
										<Ban size={12} />
										Anular
									</button>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Table -->
	<div class="glass-card hidden overflow-hidden lg:block">
		<div class="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
			<div>
				<h2 class="text-sm font-semibold tracking-[-0.01em] text-brand-navy">Listado detallado</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Ledger operativo con montos originales, tasa aplicada, estado y trazabilidad por usuario.
				</p>
			</div>
			<span
				class="inline-flex items-center rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold tracking-[0.12em] text-brand-navy uppercase"
			>
				{expenses.length} registro{expenses.length === 1 ? '' : 's'}
			</span>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[82rem] text-left text-sm">
				<thead
					class="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase"
				>
					<tr>
						<th class="px-4 py-3">Fecha</th>
						<th class="px-4 py-3">Categoría</th>
						<th class="px-4 py-3">Descripción</th>
						<th class="px-4 py-3 text-right">Monto</th>
						<th class="px-4 py-3 text-right">USD BCV</th>
						<th class="px-4 py-3">Registró</th>
						<th class="px-4 py-3">Referencia</th>
						<th class="px-4 py-3">Estado</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200/80">
					{#each expenses as row (row.id)}
						<tr
							class="odd:bg-white even:bg-slate-50/40 hover:bg-slate-50 {row.voidedAt
								? 'opacity-65'
								: ''}"
						>
							<td class="px-4 py-3">
								{formatDateOnly(row.expenseDate, { dateStyle: 'medium' })}
							</td>
							<td class="px-4 py-3">{EXPENSE_CATEGORY_LABELS[row.category]}</td>
							<td class="px-4 py-3">
								<div class={row.voidedAt ? 'line-through decoration-rose-300' : ''}>
									{row.description}
								</div>
							</td>
							<td class="px-4 py-3 text-right font-mono tabular-nums">
								{row.amount.toFixed(2)}
								<span class="text-slate-500">{row.currency}</span>
								{#if row.exchangeRate}
									<div class="text-xs text-slate-400">
										{row.currency === 'USDT' ? 'USDT' : 'Op.'}
										{row.exchangeRate.toFixed(2)}
									</div>
								{/if}
								{#if row.bcvRate}
									<div class="text-xs text-slate-400">BCV {row.bcvRate.toFixed(2)}</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono font-semibold text-rose-700 tabular-nums">
								{formatPrice(row.amountUsd)}
							</td>
							<td class="px-4 py-3 text-xs text-slate-500">{row.registeredByName ?? '-'}</td>
							<td class="px-4 py-3 text-xs text-slate-500">{row.reference ?? '—'}</td>
							<td class="px-4 py-3 align-top">
								{#if row.voidedAt}
									<div
										class="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-rose-700 uppercase"
									>
										Anulado
									</div>
									{#if row.voidReason}
										<div class="mt-1 max-w-[12rem] text-xs text-rose-600">{row.voidReason}</div>
									{/if}
								{:else}
									<div
										class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-emerald-700 uppercase"
									>
										Activo
									</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								{#if !row.voidedAt}
									<button
										type="button"
										onclick={() => handleVoid(row)}
										class="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
										aria-label="Anular egreso"
									>
										<Ban size={12} />
										Anular
									</button>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="9" class="px-4 py-8 text-center text-slate-400">
								Sin egresos en el período seleccionado
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Create modal -->
{#if showCreate}
	<div
		class="fixed inset-0 z-50 bg-brand-navy/40 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-expense-title"
	>
		<div class="flex h-full items-end justify-center p-2 sm:items-center sm:p-4">
			<form
				onsubmit={submitCreate}
				class="flex h-[calc(100dvh-0.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-surface-container-lowest shadow-xl sm:h-auto sm:max-h-[90dvh]"
			>
				<div class="border-b border-surface-container-high px-4 py-4 sm:px-6">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class={mobileLabelClass}>Nuevo egreso</p>
							<h2
								id="new-expense-title"
								class="mt-1 text-xl font-semibold tracking-[-0.02em] text-brand-navy"
							>
								Registrar egreso
							</h2>
							<p class="mt-1 text-sm text-on-surface-variant">
								Carga un gasto operativo con su moneda, referencia y notas.
							</p>
						</div>
						<button
							type="button"
							onclick={closeCreate}
							class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-brand-navy transition hover:bg-surface-container-high"
							aria-label="Cerrar formulario de egreso"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Categoría *</span
							>
							<select bind:value={form.category} required class={fieldInputClass}>
								{#each ALL_EXPENSE_CATEGORIES as c (c)}
									<option value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Fecha *</span
							>
							<input type="date" bind:value={form.expenseDate} required class={fieldInputClass} />
						</label>

						<label class="col-span-full flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Descripción *</span
							>
							<input
								type="text"
								bind:value={form.description}
								required
								minlength="3"
								maxlength="500"
								class={fieldInputClass}
								placeholder="Pago de electricidad de noviembre"
							/>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Moneda *</span
							>
							<select bind:value={form.currency} required class={fieldInputClass}>
								{#each ALL_EXPENSE_CURRENCIES as c (c)}
									<option value={c}>{EXPENSE_CURRENCY_LABELS[c]}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Monto *</span
							>
							<input
								type="number"
								min="0"
								step="0.01"
								inputmode="decimal"
								bind:value={form.amount}
								required
								class={`${fieldInputClass} text-right font-mono`}
							/>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Tasa BCV referencia *</span
							>
							<input
								type="number"
								min="0"
								step="0.0001"
								inputmode="decimal"
								bind:value={form.bcvRate}
								required
								class={`${fieldInputClass} text-right font-mono`}
							/>
							{#if bcvRateHint}
								<button
									type="button"
									class="self-start rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-brand-blue"
									onclick={() => (form.bcvRate = (bcvRateHint ?? 0).toFixed(2))}
								>
									Usar BCV: {bcvRateHint.toFixed(2)}
								</button>
							{/if}
						</label>

						{#if needsExchangeRate}
							<label class="flex flex-col gap-1.5 text-sm">
								<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
									{exchangeRateLabel} *
								</span>
								<input
									type="number"
									min="0"
									step="0.0001"
									inputmode="decimal"
									bind:value={form.exchangeRate}
									required
									class={`${fieldInputClass} text-right font-mono`}
								/>
								{#if form.currency === 'VES' && bcvRateHint}
									<button
										type="button"
										class="self-start rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-brand-blue"
										onclick={() => (form.exchangeRate = (bcvRateHint ?? 0).toFixed(2))}
									>
										Usar BCV: {bcvRateHint.toFixed(2)}
									</button>
								{:else if form.currency === 'USDT' && usdtRateHint}
									<button
										type="button"
										class="self-start rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-brand-blue"
										onclick={() => (form.exchangeRate = (usdtRateHint ?? 0).toFixed(2))}
									>
										Usar USDT: {usdtRateHint.toFixed(2)}
									</button>
								{/if}
							</label>

							{#if needsRateType}
								<label class="flex flex-col gap-1.5 text-sm">
									<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
										>Tipo de tasa *</span
									>
									<select bind:value={form.rateType} required class={fieldInputClass}>
										{#each ALL_RATE_TYPES as t (t)}
											<option value={t}>{RATE_TYPE_LABELS[t]}</option>
										{/each}
									</select>
								</label>
							{/if}
						{/if}

						{#if normalizedAmountPreview > 0}
							<div
								class="col-span-full rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant"
							>
								Se registrarán <span class="font-mono font-semibold text-brand-navy"
									>{formatPrice(normalizedAmountPreview)}</span
								>
								como USD BCV.
							</div>
						{/if}

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Referencia</span
							>
							<input
								type="text"
								bind:value={form.reference}
								maxlength="100"
								class={fieldInputClass}
								placeholder="Nº de factura, recibo..."
							/>
						</label>

						<label class="col-span-full flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Notas</span
							>
							<textarea bind:value={form.notes} maxlength="1000" rows="3" class={fieldInputClass}
							></textarea>
						</label>
					</div>
				</div>

				<div
					class="border-t border-surface-container-high bg-surface-container-low px-4 py-3 sm:px-6"
				>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={closeCreate}
							disabled={creating}
							class="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-surface-container-highest disabled:opacity-50"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={creating}
							class="rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition hover:bg-brand-gold-dark disabled:opacity-50"
						>
							{creating ? 'Guardando...' : 'Registrar egreso'}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
