<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Plus, Ban } from '@lucide/svelte';
	import { ReportHeader, DateRangeFilter } from '$lib/components/reports';
	import { formatPrice, formatDate, downloadCsv, getErrorMessage } from '$lib/utils';
	import {
		ALL_EXPENSE_CATEGORIES,
		ALL_EXPENSE_CURRENCIES,
		ALL_RATE_TYPES,
		EXPENSE_CATEGORY_LABELS,
		EXPENSE_CURRENCY_LABELS,
		RATE_TYPE_LABELS,
		isUsdLike,
		type ExpenseCategory,
		type ExpenseCurrency,
		type RateType
	} from '$lib/shared/enums';
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

	function emptyForm() {
		const today = new Date().toISOString().slice(0, 10);
		return {
			category: 'OTHER' as ExpenseCategory,
			description: '',
			currency: 'USD' as ExpenseCurrency,
			amount: '' as string,
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
			}).run();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando egresos'));
		} finally {
			loading = false;
		}
	}

	async function openCreate() {
		form = emptyForm();
		showCreate = true;
		// Pre-fill BCV rate
		try {
			const rates = await fetchLatestRates();
			const usd = rates.find((r) => r.currency.code === 'USD');
			if (usd) {
				bcvRateHint = usd.rateToVes;
			}
		} catch {
			bcvRateHint = null;
		}
	}

	function closeCreate() {
		showCreate = false;
	}

	const needsRate = $derived(form.currency === 'VES' || form.currency === 'EUR');

	async function submitCreate(ev: SubmitEvent) {
		ev.preventDefault();
		creating = true;
		try {
			const amount = Number(form.amount);
			const exchangeRate = needsRate ? Number(form.exchangeRate) : undefined;
			if (Number.isNaN(amount) || amount <= 0) {
				toast.error('Monto inválido');
				return;
			}
			if (needsRate && (Number.isNaN(exchangeRate ?? NaN) || (exchangeRate ?? 0) <= 0)) {
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
				bcvRate: bcvRateHint && form.currency === 'VES' ? bcvRateHint : undefined,
				rateType: needsRate ? form.rateType : undefined,
				expenseDate: isoDate,
				reference: form.reference.trim() || undefined,
				notes: form.notes.trim() || undefined
			});
			toast.success('Egreso registrado');
			showCreate = false;
			await applyFilter();
		} catch (e) {
			console.error(e);
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
			console.error(e);
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
			'Equivalente USD',
			'Tasa',
			'Registrado por',
			'Referencia',
			'Estado'
		];
		const rows = expenses.map((e) => [
			formatDate(e.expenseDate, { dateStyle: 'short' }),
			EXPENSE_CATEGORY_LABELS[e.category],
			e.description,
			e.currency,
			e.amount.toFixed(2),
			e.amountUsd.toFixed(2),
			e.exchangeRate?.toFixed(2) ?? '',
			e.registeredByName ?? '',
			e.reference ?? '',
			e.voidedAt ? 'ANULADO' : 'Activo'
		]);
		downloadCsv(`egresos-${dateFrom}-a-${dateTo}.csv`, headers, rows);
	}

	const total = $derived(expenses.filter((e) => !e.voidedAt).reduce((s, e) => s + e.amountUsd, 0));
</script>

<svelte:head>
	<title>Egresos - Caja - Optikt</title>
</svelte:head>

<div class="p-8">
	<ReportHeader
		title="Egresos"
		subtitle="Gastos operativos del negocio"
		onExportCsv={handleExportCsv}
		onPrint={() => window.print()}
	/>

	<div class="mb-4 flex flex-wrap items-end gap-4">
		<DateRangeFilter bind:dateFrom bind:dateTo {loading} onApply={applyFilter} />

		<div class="flex flex-col gap-1">
			<label for="cat" class="text-sm font-medium text-slate-700">Categoría</label>
			<select
				id="cat"
				bind:value={categoryFilter}
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
			>
				<option value="">Todas</option>
				{#each ALL_EXPENSE_CATEGORIES as c (c)}
					<option value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
				{/each}
			</select>
		</div>

		<label class="flex items-center gap-2 text-sm text-slate-700">
			<input type="checkbox" bind:checked={includeVoided} class="rounded" />
			Incluir anulados
		</label>

		<button
			type="button"
			onclick={openCreate}
			class="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue/90"
		>
			<Plus size={16} />
			Nuevo egreso
		</button>
	</div>

	<!-- Summary -->
	<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Total egresos (USD)</p>
			<p class="text-2xl font-bold text-rose-600">{formatPrice(total)}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Cantidad</p>
			<p class="text-2xl font-bold text-slate-900">
				{expenses.filter((e) => !e.voidedAt).length}
			</p>
		</div>
	</div>

	<!-- Table -->
	<div class="glass-card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
					<tr>
						<th class="px-4 py-3">Fecha</th>
						<th class="px-4 py-3">Categoría</th>
						<th class="px-4 py-3">Descripción</th>
						<th class="px-4 py-3 text-right">Monto</th>
						<th class="px-4 py-3 text-right">USD</th>
						<th class="px-4 py-3">Registró</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each expenses as row (row.id)}
						<tr class="hover:bg-slate-50 {row.voidedAt ? 'opacity-50' : ''}">
							<td class="px-4 py-3">
								{formatDate(row.expenseDate, { dateStyle: 'medium' })}
							</td>
							<td class="px-4 py-3">{EXPENSE_CATEGORY_LABELS[row.category]}</td>
							<td class="px-4 py-3">
								<div>{row.description}</div>
								{#if row.reference}
									<div class="text-xs text-slate-400">Ref: {row.reference}</div>
								{/if}
								{#if row.voidedAt}
									<div class="text-xs font-semibold text-rose-600">
										ANULADO — {row.voidReason}
									</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono">
								{row.amount.toFixed(2)}
								{row.currency}
								{#if !isUsdLike(row.currency) && row.exchangeRate}
									<div class="text-xs text-slate-400">@ {row.exchangeRate.toFixed(2)}</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono font-semibold text-rose-700">
								{formatPrice(row.amountUsd)}
							</td>
							<td class="px-4 py-3 text-xs text-slate-500">{row.registeredByName ?? '-'}</td>
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
							<td colspan="7" class="px-4 py-8 text-center text-slate-400">
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-expense-title"
	>
		<form onsubmit={submitCreate} class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
			<h2 id="new-expense-title" class="mb-4 text-xl font-bold text-brand-navy">Nuevo egreso</h2>

			<div class="grid gap-4 sm:grid-cols-2">
				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Categoría *</span>
					<select
						bind:value={form.category}
						required
						class="rounded-lg border border-slate-300 px-3 py-2"
					>
						{#each ALL_EXPENSE_CATEGORIES as c (c)}
							<option value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Fecha *</span>
					<input
						type="date"
						bind:value={form.expenseDate}
						required
						class="rounded-lg border border-slate-300 px-3 py-2"
					/>
				</label>

				<label class="col-span-full flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Descripción *</span>
					<input
						type="text"
						bind:value={form.description}
						required
						minlength="3"
						maxlength="500"
						class="rounded-lg border border-slate-300 px-3 py-2"
						placeholder="Pago de electricidad de noviembre"
					/>
				</label>

				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Moneda *</span>
					<select
						bind:value={form.currency}
						required
						class="rounded-lg border border-slate-300 px-3 py-2"
					>
						{#each ALL_EXPENSE_CURRENCIES as c (c)}
							<option value={c}>{EXPENSE_CURRENCY_LABELS[c]}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Monto *</span>
					<input
						type="number"
						min="0"
						step="0.01"
						bind:value={form.amount}
						required
						class="rounded-lg border border-slate-300 px-3 py-2 text-right font-mono"
					/>
				</label>

				{#if needsRate}
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">
							Tasa * {form.currency === 'EUR' ? '(EUR→USD)' : '(Bs/USD)'}
						</span>
						<input
							type="number"
							min="0"
							step="0.0001"
							bind:value={form.exchangeRate}
							required
							class="rounded-lg border border-slate-300 px-3 py-2 text-right font-mono"
						/>
						{#if form.currency === 'VES' && bcvRateHint}
							<button
								type="button"
								class="self-start text-xs text-brand-blue underline"
								onclick={() => (form.exchangeRate = String(bcvRateHint))}
							>
								Usar BCV: {bcvRateHint.toFixed(2)}
							</button>
						{/if}
					</label>

					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Tipo de tasa *</span>
						<select
							bind:value={form.rateType}
							required
							class="rounded-lg border border-slate-300 px-3 py-2"
						>
							{#each ALL_RATE_TYPES as t (t)}
								<option value={t}>{RATE_TYPE_LABELS[t]}</option>
							{/each}
						</select>
					</label>
				{/if}

				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Referencia</span>
					<input
						type="text"
						bind:value={form.reference}
						maxlength="100"
						class="rounded-lg border border-slate-300 px-3 py-2"
						placeholder="Nº de factura, recibo..."
					/>
				</label>

				<label class="col-span-full flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Notas</span>
					<textarea
						bind:value={form.notes}
						maxlength="1000"
						rows="2"
						class="rounded-lg border border-slate-300 px-3 py-2"
					></textarea>
				</label>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={closeCreate}
					disabled={creating}
					class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
				>
					Cancelar
				</button>
				<button
					type="submit"
					disabled={creating}
					class="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue/90 disabled:opacity-50"
				>
					{creating ? 'Guardando...' : 'Registrar egreso'}
				</button>
			</div>
		</form>
	</div>
{/if}
