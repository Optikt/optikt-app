<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { downloadCsv, getErrorMessage } from '$lib/utils';
	import {
		getCashReportQuery,
		getDailyBreakdownQuery,
		getPipelineQuery
	} from '$lib/remote/cash.remote';
	import type {
		CashReport,
		DailyBreakdownRow,
		PipelineSnapshot
	} from '$lib/server/db/queries/cash';
	import CashToolbar from '$lib/components/cash/CashToolbar.svelte';
	import CashSummary from '$lib/components/cash/CashSummary.svelte';
	import CashPipeline from '$lib/components/cash/CashPipeline.svelte';
	import CashDailyTable from '$lib/components/cash/CashDailyTable.svelte';
	import { buildCashCsvRows, CASH_CSV_HEADERS } from '$lib/components/cash/cashReport';

	let { data } = $props();
	const initial = untrack(() => data);

	let report = $state<CashReport>(initial.report);
	let daily = $state<DailyBreakdownRow[]>(initial.daily);
	let pipeline = $state<PipelineSnapshot>(initial.pipeline);
	let dateFrom = $state(initial.dateFrom);
	let dateTo = $state(initial.dateTo);
	let loading = $state(false);

	async function applyFilter() {
		loading = true;
		try {
			const [r, d, p] = await Promise.all([
				getCashReportQuery({ from: dateFrom, to: dateTo }),
				getDailyBreakdownQuery({ from: dateFrom, to: dateTo }),
				getPipelineQuery()
			]);
			report = r;
			daily = d;
			pipeline = p;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando reporte de caja'));
		} finally {
			loading = false;
		}
	}

	function handleExportCsv() {
		downloadCsv(`caja-${dateFrom}-a-${dateTo}.csv`, CASH_CSV_HEADERS, buildCashCsvRows(daily));
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Caja y P&L - Optikt</title>
</svelte:head>

<div class="px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<CashToolbar
		bind:dateFrom
		bind:dateTo
		{loading}
		totalCollected={report.totalCollected}
		netProfit={report.netProfit}
		onApply={applyFilter}
		onExport={handleExportCsv}
		onPrint={handlePrint}
	/>

	<CashSummary {report} />

	<CashPipeline {report} {pipeline} />

	<CashDailyTable {daily} />
</div>
