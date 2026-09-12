<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { downloadCsv, getErrorMessage } from '$lib/utils';
	import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '$lib/shared/enums';
	import {
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
	import ExpenseToolbar from '$lib/components/cash/ExpenseToolbar.svelte';
	import ExpenseSummary from '$lib/components/cash/ExpenseSummary.svelte';
	import ExpenseTable from '$lib/components/cash/ExpenseTable.svelte';
	import ExpenseCreateModal from '$lib/components/cash/ExpenseCreateModal.svelte';
	import {
		EXPENSE_CSV_HEADERS,
		buildExpenseCsvRows,
		emptyExpenseForm,
		validateVoidReason,
		type ExpenseFormData
	} from '$lib/components/cash/expenseForm';

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
	let form = $state<ExpenseFormData>(emptyExpenseForm());
	let bcvRateHint = $state<number | null>(null);
	let usdtRateHint = $state<number | null>(null);

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
		form = emptyExpenseForm();
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

	async function submitCreate(ev: SubmitEvent) {
		ev.preventDefault();
		creating = true;
		try {
			const amount = Number(form.amount);
			const bcvRate = Number(form.bcvRate);
			const needsExchangeRate = requiresExpenseExchangeRate(form.currency);
			const needsRateType = requiresExpenseRateType(form.currency);
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
			await createExpenseCommand({
				category: form.category,
				description: form.description.trim(),
				currency: form.currency,
				amount,
				exchangeRate,
				bcvRate,
				rateType: needsRateType ? form.rateType : undefined,
				expenseDate: form.expenseDate,
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
		const reasonError = validateVoidReason(reason);
		if (reasonError) {
			toast.error(reasonError);
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
		downloadCsv(
			`egresos-${dateFrom}-a-${dateTo}.csv`,
			EXPENSE_CSV_HEADERS,
			buildExpenseCsvRows(expenses)
		);
	}

	function handlePrint() {
		window.print();
	}

	const activeCount = $derived(expenses.filter((e) => !e.voidedAt).length);
	const total = $derived(expenses.filter((e) => !e.voidedAt).reduce((s, e) => s + e.amountUsd, 0));
	const selectedCategoryLabel = $derived(
		categoryFilter ? EXPENSE_CATEGORY_LABELS[categoryFilter] : 'Todas'
	);
</script>

<svelte:head>
	<title>Egresos - Caja - Optikt</title>
</svelte:head>

<div class="px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<ExpenseToolbar
		bind:dateFrom
		bind:dateTo
		bind:categoryFilter
		bind:includeVoided
		{loading}
		{selectedCategoryLabel}
		onApply={applyFilter}
		onExport={handleExportCsv}
		onPrint={handlePrint}
		onCreate={openCreate}
	/>

	<ExpenseSummary
		{total}
		{activeCount}
		visibleCount={expenses.length}
		{includeVoided}
		{selectedCategoryLabel}
		{dateFrom}
		{dateTo}
	/>

	<ExpenseTable {expenses} onVoid={handleVoid} />
</div>

<ExpenseCreateModal
	bind:showCreate
	bind:form
	{creating}
	{bcvRateHint}
	{usdtRateHint}
	onClose={closeCreate}
	onSubmit={submitCreate}
/>
