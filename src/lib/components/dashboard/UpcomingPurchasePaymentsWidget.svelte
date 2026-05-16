<script lang="ts">
	import { ArrowRight, CalendarClock, CircleDollarSign } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { PurchaseOrderDueBadge } from '$lib/components/ui';
	import type { UpcomingPurchaseOrderDue } from '$lib/server/db/queries/purchaseOrderCreditSchedule';
	import { formatDateOnly, formatPrice } from '$lib/utils';

	interface Props {
		dues: UpcomingPurchaseOrderDue[];
	}

	let { dues }: Props = $props();

	const overdueCount = $derived(
		dues.filter((due) => due.dueStatus.kind === 'OVERDUE').length
	);
	const totalPending = $derived(dues.reduce((sum, due) => sum + due.balance.balance, 0));

	function formatOrderNumber(orderNumber: number): string {
		return `PO-${String(orderNumber).padStart(4, '0')}`;
	}

	function dueAmount(due: UpcomingPurchaseOrderDue): number {
		return Number(due.expectedAmountUsd ?? due.balance.balance ?? 0);
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
					{dues.length} orden{dues.length === 1 ? '' : 'es'} con saldo próximo
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

	{#if dues.length === 0}
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
			{#each dues.slice(0, 6) as due (due.id)}
				<li>
					<a
						href={resolve(`/purchases/${due.purchaseOrder.id}`)}
						class="flex flex-col gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 no-underline transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span class="font-mono text-sm font-semibold text-brand-navy">
									{formatOrderNumber(due.purchaseOrder.orderNumber)}
								</span>
								<PurchaseOrderDueBadge dueStatus={due.dueStatus} showNone />
							</div>
							<p class="mt-1 truncate text-sm text-on-surface-variant">
								{due.supplier?.name ?? 'Sin proveedor'}
							</p>
						</div>
						<div class="flex items-center justify-between gap-3 sm:justify-end">
							<div class="text-right">
								<p class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
									{formatPrice(dueAmount(due))}
								</p>
								<p class="text-xs text-on-surface-variant">
									{formatDateOnly(due.dueDate, { day: '2-digit', month: 'short' })}
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
