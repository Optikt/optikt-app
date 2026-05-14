<script lang="ts">
	import { ArrowRight, CalendarClock, CircleDollarSign } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { PurchaseOrderDueBadge } from '$lib/components/ui';
	import type { UpcomingPurchaseOrderInstallment } from '$lib/server/db/queries/purchaseOrderCreditSchedule';
	import { formatDateOnly, formatPrice } from '$lib/utils';

	interface Props {
		installments: UpcomingPurchaseOrderInstallment[];
	}

	let { installments }: Props = $props();

	const overdueCount = $derived(
		installments.filter((installment) => installment.dueStatus.kind === 'OVERDUE').length
	);
	const totalPending = $derived(
		installments.reduce((sum, installment) => sum + installment.balance.balance, 0)
	);

	function formatOrderNumber(orderNumber: number): string {
		return `PO-${String(orderNumber).padStart(4, '0')}`;
	}

	function installmentAmount(installment: UpcomingPurchaseOrderInstallment): number {
		return Number(installment.expectedAmountUsd ?? installment.balance.balance ?? 0);
	}
</script>

<div class="glass-card p-6">
	<div class="mb-4 flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
			>
				<CalendarClock size={20} />
			</div>
			<div class="min-w-0">
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Vencimientos proveedores
				</p>
				<p class="font-heading text-xl font-bold text-brand-navy">
					{installments.length} cuota{installments.length === 1 ? '' : 's'} pendiente{installments.length ===
					1
						? ''
						: 's'}
				</p>
			</div>
		</div>

		{#if overdueCount > 0}
			<span
				class="inline-flex shrink-0 items-center rounded-md bg-error-container px-2.5 py-1 text-xs font-semibold text-on-error-container uppercase"
			>
				{overdueCount} vencida{overdueCount === 1 ? '' : 's'}
			</span>
		{/if}
	</div>

	{#if installments.length === 0}
		<div class="rounded-xl border border-dashed border-outline-variant/40 px-4 py-6 text-center">
			<p class="text-sm font-medium text-on-surface-variant">Sin vencimientos próximos</p>
			<p class="mt-1 text-xs text-outline">Las compras a crédito con saldo aparecerán aquí.</p>
		</div>
	{:else}
		<div class="mb-4 rounded-xl bg-surface-container-low px-4 py-3">
			<div class="flex items-center justify-between gap-3">
				<span
					class="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-on-surface-variant uppercase"
				>
					<CircleDollarSign size={14} />
					Saldo observado
				</span>
				<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
					{formatPrice(totalPending)}
				</span>
			</div>
		</div>

		<ul class="space-y-2">
			{#each installments.slice(0, 6) as installment (installment.id)}
				<li>
					<a
						href={resolve(`/purchases/${installment.purchaseOrder.id}`)}
						class="flex flex-col gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 no-underline transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-mono text-sm font-semibold text-brand-navy">
									{formatOrderNumber(installment.purchaseOrder.orderNumber)}
								</span>
								<PurchaseOrderDueBadge dueStatus={installment.dueStatus} showNone />
							</div>
							<p class="mt-1 truncate text-sm text-on-surface-variant">
								{installment.supplier?.name ?? 'Sin proveedor'}
							</p>
						</div>
						<div class="flex items-center justify-between gap-3 sm:justify-end">
							<div class="text-right">
								<p class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
									{formatPrice(installmentAmount(installment))}
								</p>
								<p class="text-xs text-on-surface-variant">
									{formatDateOnly(installment.dueDate, { day: '2-digit', month: 'short' })}
								</p>
							</div>
							<ArrowRight class="h-4 w-4 text-brand-blue" />
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
