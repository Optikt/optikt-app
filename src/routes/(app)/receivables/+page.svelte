<script lang="ts">
	import {
		HandCoins,
		Search,
		RotateCcw,
		Clock3,
		DollarSign,
		CalendarDays,
		X,
		Wallet
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { PageHeader } from '$lib/components/ui';
	import { PaymentForm } from '$lib/components/sales';
	import { formatPrice, formatDate, replaceUrlSearch, setQueryParam } from '$lib/utils';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import type { ReceivableRow, ReceivablesSummary } from '$lib/server/db/queries/receivables';
	import { getPaymentMethodLabel } from '$lib/shared/enums';
	import { untrack } from 'svelte';

	let { data } = $props();

	let rows = $state<ReceivableRow[]>(untrack(() => data.rows));
	let summary = $state<ReceivablesSummary>(untrack(() => data.summary));
	const store = getExchangeRatesStore();
	const bcvRate = $derived(store.bcvRate);
	const initialQuery = untrack(() => page.url.searchParams);
	const initialSearch = initialQuery.get('q') ?? '';
	const initialAge = initialQuery.get('age');
	const initialSort = initialQuery.get('sort');

	// Filters
	let searchQuery = $state(initialSearch);
	let ageFilter = $state<'' | 'recent' | 'tracking' | 'overdue'>(
		initialAge === 'recent' || initialAge === 'tracking' || initialAge === 'overdue'
			? initialAge
			: ''
	);
	let sortBy = $state<'balance' | 'oldest' | 'name'>(
		initialSort === 'oldest' || initialSort === 'name' ? initialSort : 'balance'
	);

	// Payment modal
	let paymentModal = $state<{
		open: boolean;
		row: ReceivableRow | null;
	}>({ open: false, row: null });

	function syncFromData() {
		const next = untrack(() => data);
		rows = next.rows;
		summary = next.summary;
	}

	// Filtered + sorted rows
	const filteredRows = $derived.by(() => {
		let result = rows;

		// Search by customer name
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			result = result.filter((r) => {
				const name = r.customerName?.toLowerCase() ?? 'cliente general';
				const idNumber = r.customerIdNumber?.toLowerCase() ?? '';
				return name.includes(q) || idNumber.includes(q);
			});
		}

		// Age filter
		if (ageFilter === 'recent') {
			result = result.filter((r) => r.daysPending <= 7);
		} else if (ageFilter === 'tracking') {
			result = result.filter((r) => r.daysPending >= 8 && r.daysPending <= 30);
		} else if (ageFilter === 'overdue') {
			result = result.filter((r) => r.daysPending > 30);
		}

		// Sort
		if (sortBy === 'balance') {
			result = [...result].sort((a, b) => b.balance - a.balance);
		} else if (sortBy === 'oldest') {
			result = [...result].sort((a, b) => b.daysPending - a.daysPending);
		} else if (sortBy === 'name') {
			result = [...result].sort((a, b) => {
				const nameA = a.customerName ?? 'ZZZZZ';
				const nameB = b.customerName ?? 'ZZZZZ';
				return nameA.localeCompare(nameB);
			});
		}

		return result;
	});

	const hasActiveFilters = $derived(
		searchQuery.trim().length > 0 || ageFilter !== '' || sortBy !== 'balance'
	);

	function syncUrl(): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', searchQuery.trim());
			setQueryParam(params, 'age', ageFilter || null);
			setQueryParam(params, 'sort', sortBy === 'balance' ? null : sortBy);
		});
	}

	function clearFilters() {
		searchQuery = '';
		ageFilter = '';
		sortBy = 'balance';
		syncUrl();
	}

	function openPaymentModal(row: ReceivableRow) {
		paymentModal = { open: true, row };
	}

	function closePaymentModal() {
		paymentModal = { open: false, row: null };
	}

	async function handlePaymentAdded(newPaidAmount: number) {
		const row = paymentModal.row;
		closePaymentModal();

		await invalidateAll();
		syncFromData();

		if (row) {
			if (newPaidAmount >= row.totalAmount - 0.01) {
				toast.success('Venta completada. Saldo saldado.');
			} else {
				toast.success(
					`Pago registrado. Saldo pendiente: ${formatPrice(Math.max(0, row.totalAmount - newPaidAmount))}`
				);
			}
		}
	}

	function daysBadgeClasses(days: number): string {
		if (days <= 7) return 'bg-success-container text-on-success-container';
		if (days <= 30) return 'bg-warning-container text-on-warning-container';
		return 'bg-error-container text-on-error-container';
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			syncUrl();
		}, 150);
	}
</script>

<svelte:head>
	<title>Cuentas por Cobrar - Optikt</title>
	<meta name="description" content="Gestión de cuentas por cobrar - Optikt" />
</svelte:head>

<div class="p-6">
	<PageHeader title="Cuentas por Cobrar" subtitle="Gestión de cobros pendientes">
		{#snippet actions()}
			{#if summary.totalCount > 0}
				<div
					class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-semibold text-white"
				>
					<Wallet size={18} />
					<span class="font-mono">{formatPrice(summary.totalBalance)}</span>
					<span class="text-white/60"
						>pendientes en {summary.totalCount} venta{summary.totalCount !== 1 ? 's' : ''}</span
					>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Stats Cards -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<!-- Total pendiente -->
		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-gold-dark"
				>
					<DollarSign size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Total Pendiente</p>
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">
				{formatPrice(summary.totalBalance)}
			</p>
		</div>

		<!-- Ventas pendientes -->
		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<HandCoins size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Ventas Pendientes
				</p>
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">{summary.totalCount}</p>
		</div>

		<!-- Promedio días -->
		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue"
				>
					<CalendarDays size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Promedio Días</p>
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">
				{summary.avgDaysPending}
				<span class="text-base font-normal text-slate-400">días</span>
			</p>
		</div>
	</div>

	<!-- Filters -->
	<div
		class="glass-card mb-6 flex flex-col gap-4 bg-surface-container-low p-4 md:flex-row md:items-center"
	>
		<div class="relative flex-1">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline" />
			<input
				id="receivables-search"
				name="receivables-search"
				type="search"
				bind:value={searchQuery}
				oninput={handleSearch}
				placeholder="Buscar por nombre de cliente o cédula..."
				class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-10 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			/>
		</div>

		<div class="flex w-full gap-3 md:w-auto">
			<select
				id="receivables-age-filter"
				name="receivables-age-filter"
				bind:value={ageFilter}
				onchange={syncUrl}
				class="min-w-[180px] flex-1 rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 md:flex-none"
			>
				<option value="">Todas las antigüedades</option>
				<option value="recent">Recientes (≤ 7 días)</option>
				<option value="tracking">En seguimiento (8–30 días)</option>
				<option value="overdue">Vencidos (> 30 días)</option>
			</select>

			<select
				id="receivables-sort"
				name="receivables-sort"
				bind:value={sortBy}
				onchange={syncUrl}
				class="min-w-[170px] flex-1 rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 md:flex-none"
			>
				<option value="balance">Mayor deuda</option>
				<option value="oldest">Más antiguo</option>
				<option value="name">Nombre cliente</option>
			</select>

			<button
				onclick={clearFilters}
				disabled={!hasActiveFilters}
				class="inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasActiveFilters
					? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
					: 'bg-surface-container-high text-outline'}"
				title="Limpiar filtros"
			>
				<RotateCcw size={18} />
			</button>
		</div>
	</div>

	<!-- Table -->
	<div class="glass-card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-surface-container-high bg-surface-container-low">
						<th class="px-6 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Cliente</th
						>
						<th class="px-4 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Venta</th
						>
						<th class="px-4 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Fecha</th
						>
						<th class="px-4 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Días</th
						>
						<th
							class="px-4 py-4 text-right text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Total venta</th
						>
						<th
							class="px-4 py-4 text-right text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Pagado</th
						>
						<th
							class="px-4 py-4 text-right text-xs font-semibold tracking-wider text-slate-500 uppercase"
							>Saldo</th
						>
						<th class="px-4 py-4 text-xs font-semibold tracking-wider text-slate-500 uppercase"
						></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-high">
					{#if filteredRows.length === 0}
						<tr>
							<td colspan="8" class="px-6 py-16 text-center">
								<div class="flex flex-col items-center gap-3 text-on-surface-variant">
									<HandCoins size={40} class="text-outline/40" />
									<p class="text-lg font-semibold text-brand-navy">Sin cuentas pendientes</p>
									<p class="max-w-sm text-sm text-outline">
										{hasActiveFilters
											? 'No se encontraron resultados con los filtros seleccionados.'
											: 'Todas las ventas están al día. ¡Buen trabajo!'}
									</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredRows as row (row.saleId)}
							<tr class="transition-colors hover:bg-surface-container-low/50">
								<td class="px-6 py-4">
									<div>
										<p class="font-semibold text-brand-navy">
											{row.customerName ?? 'Cliente General'}
										</p>
										{#if row.customerIdNumber}
											<p class="mt-0.5 text-xs text-outline">{row.customerIdNumber}</p>
										{:else}
											<p class="mt-0.5 text-xs text-outline italic">Sin documento</p>
										{/if}
									</div>
								</td>
								<td class="px-4 py-4">
									<a
										href={resolve(`/sales/${row.saleId}`)}
										class="font-mono text-sm font-semibold text-brand-blue no-underline hover:underline"
									>
										{row.saleNumber}
									</a>
								</td>
								<td class="px-4 py-4 text-sm text-on-surface-variant">
									{formatDate(row.createdAt, { dateStyle: 'medium' })}
								</td>
								<td class="px-4 py-4">
									<span
										class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold {daysBadgeClasses(
											row.daysPending
										)}"
									>
										<Clock3 size={12} />
										{row.daysPending}d
									</span>
								</td>
								<td class="px-4 py-4 text-right font-mono text-sm text-on-surface">
									{formatPrice(row.totalAmount)}
								</td>
								<td class="px-4 py-4 text-right font-mono text-sm text-success">
									{formatPrice(row.totalPaid)}
								</td>
								<td class="px-4 py-4 text-right">
									<span class="font-mono text-sm font-bold text-error">
										{formatPrice(row.balance)}
									</span>
								</td>
								<td class="px-4 py-4">
									<button
										onclick={() => openPaymentModal(row)}
										class="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-xs font-bold tracking-wide text-brand-navy uppercase transition-all hover:bg-brand-gold-dark hover:shadow-sm"
									>
										<DollarSign size={14} />
										Registrar pago
									</button>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Payment Modal -->
{#if paymentModal.open && paymentModal.row}
	{@const row = paymentModal.row}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 backdrop-blur-sm"
		onkeydown={(e) => e.key === 'Escape' && closePaymentModal()}
		onclick={(e) => {
			if (e.target === e.currentTarget) closePaymentModal();
		}}
	>
		<div
			class="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="Registrar pago"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between rounded-t-2xl border-b border-surface-container-high bg-surface-container-low px-6 py-5"
			>
				<div>
					<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
						Registrar pago
					</p>
					<h2 class="mt-1 text-xl font-semibold text-brand-navy">
						Venta {row.saleNumber} - {row.customerName ?? 'Cliente General'}
					</h2>
				</div>

				<div class="flex items-center gap-4">
					<div class="rounded-xl bg-brand-navy px-5 py-3 text-white">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">
							Saldo pendiente
						</p>
						<p class="mt-1 font-mono text-2xl font-bold tracking-tight">
							{formatPrice(row.balance)}
						</p>
					</div>
					<button
						onclick={closePaymentModal}
						class="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high"
					>
						<X size={20} />
					</button>
				</div>
			</div>

			<!-- Payment History (compact) -->
			{#if row.payments.length > 0}
				<div class="border-b border-surface-container-high px-6 py-4">
					<p class="mb-2 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
						Pagos previos ({row.payments.length})
					</p>
					<div class="flex flex-wrap gap-2">
						{#each row.payments as payment (payment.id)}
							<div
								class="inline-flex items-center gap-2 rounded-lg bg-success-container/50 px-3 py-1.5 text-xs"
							>
								<span class="font-medium text-on-success-container">
									{getPaymentMethodLabel(payment.method)}
								</span>
								<span class="font-mono font-semibold text-success">
									{formatPrice(payment.amountBcvUsd)}
								</span>
								<span class="text-on-success-container/60">
									{formatDate(payment.date, { dateStyle: 'short' })}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Payment Form -->
			<div class="p-6">
				<PaymentForm
					saleId={row.saleId}
					remainingBcvUsd={row.balance}
					{bcvRate}
					onPaymentAdded={handlePaymentAdded}
				/>
			</div>
		</div>
	</div>
{/if}
