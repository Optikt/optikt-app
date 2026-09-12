<script lang="ts">
	import { Ban } from '@lucide/svelte';
	import { EXPENSE_CATEGORY_LABELS } from '$lib/shared/enums';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import type { ExpenseListRow } from '$lib/server/db/queries/cash';

	interface Props {
		expenses: ExpenseListRow[];
		onVoid: (row: ExpenseListRow) => void;
	}

	let { expenses, onVoid }: Props = $props();
</script>

<div class="lg:hidden">
	<div class="rounded-[1.25rem] bg-surface-container-lowest p-4 shadow-sm">
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
								<p class="text-[10px] font-semibold tracking-[0.18em] text-outline uppercase">
									Monto
								</p>
								<p class="mt-1 font-mono text-[13px] font-semibold text-brand-navy tabular-nums">
									{row.amount.toFixed(2)}
									{row.currency}
								</p>
								<p class="mt-2 text-[10px] font-semibold tracking-[0.18em] text-outline uppercase">
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
									onclick={() => onVoid(row)}
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
									onclick={() => onVoid(row)}
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
