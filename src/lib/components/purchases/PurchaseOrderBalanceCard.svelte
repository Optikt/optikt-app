<script lang="ts">
	import { CalendarClock, Landmark, PiggyBank, Wallet } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import { getPurchasePaymentTermsLabel } from '$lib/shared/enums';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import { formatPrice } from '$lib/utils';

	interface Props {
		balance: PurchaseOrderBalanceSummary;
		dueStatus: PurchaseOrderDueStatus;
		paymentTerms: string;
		bcvRate: number;
	}

	let { balance, dueStatus, paymentTerms, bcvRate }: Props = $props();

	const dueConfig = $derived.by(() => {
		switch (dueStatus.kind) {
			case 'PAID':
				return { variant: 'success' as const, label: 'Pagada' };
			case 'OVERDUE':
				return { variant: 'error' as const, label: 'Vencida' };
			case 'DUE_TODAY':
				return { variant: 'warning' as const, label: 'Vence hoy' };
			case 'EARLY_DISCOUNT_AVAILABLE':
				return {
					variant: 'info' as const,
					label:
						dueStatus.daysUntil != null ? `Pronto pago · ${dueStatus.daysUntil}d` : 'Pronto pago'
				};
			case 'UPCOMING':
				return {
					variant: 'warning' as const,
					label: dueStatus.daysUntil != null ? `Vence en ${dueStatus.daysUntil}d` : 'Por vencer'
				};
			default:
				return { variant: 'neutral' as const, label: 'Sin vencimiento' };
		}
	});

	const balanceInBs = $derived(balance.balance * Number(bcvRate || 0));
	const paidInBs = $derived(balance.totalPaid * Number(bcvRate || 0));
</script>

<section class="glass-card overflow-hidden">
	<div class="border-b border-outline-variant/15 bg-surface-container-lowest px-6 py-5">
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
					Saldo con proveedor
				</p>
				<h2 class="mt-2 text-xl font-semibold text-brand-navy">Balance financiero</h2>
			</div>
			<AppBadge variant={dueConfig.variant}>{dueConfig.label}</AppBadge>
		</div>
	</div>

	<div class="space-y-4 px-6 py-6">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-2xl bg-surface-container-low p-4">
				<div class="flex items-center gap-2 text-sm text-on-surface-variant">
					<Wallet class="h-4 w-4" />
					Deuda actual
				</div>
				<p class="mt-3 font-mono text-2xl font-semibold text-brand-navy tabular-nums">
					{formatPrice(balance.debtTotal)}
				</p>
			</div>
			<div class="rounded-2xl bg-surface-container-low p-4">
				<div class="flex items-center gap-2 text-sm text-on-surface-variant">
					<Landmark class="h-4 w-4" />
					Pagado registrado
				</div>
				<p class="mt-3 font-mono text-2xl font-semibold text-brand-navy tabular-nums">
					{formatPrice(balance.totalPaid)}
				</p>
				{#if paidInBs > 0}
					<p class="mt-1 font-mono text-xs text-outline tabular-nums">
						Bs. {paidInBs.toLocaleString('es-VE', {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}
					</p>
				{/if}
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-2xl bg-info-container/35 p-4">
				<div class="flex items-center gap-2 text-sm text-on-surface-variant">
					<PiggyBank class="h-4 w-4" />
					Descuento obtenido
				</div>
				<p class="mt-3 font-mono text-2xl font-semibold text-brand-navy tabular-nums">
					{formatPrice(balance.earlyPaymentDiscountEarned)}
				</p>
			</div>
			<div class="rounded-2xl bg-brand-navy p-4 text-white">
				<div class="flex items-center gap-2 text-sm text-white/72">
					<CalendarClock class="h-4 w-4" />
					Saldo pendiente
				</div>
				<p class="mt-3 font-mono text-2xl font-semibold tabular-nums">
					{formatPrice(balance.balance)}
				</p>
				{#if balanceInBs > 0}
					<p class="mt-1 font-mono text-xs text-white/65 tabular-nums">
						Bs. {balanceInBs.toLocaleString('es-VE', {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}
					</p>
				{/if}
			</div>
		</div>

		<div
			class="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm"
		>
			<AppBadge variant="neutral">{getPurchasePaymentTermsLabel(paymentTerms)}</AppBadge>
			{#if dueStatus.date}
				<span class="font-mono text-on-surface-variant tabular-nums">{dueStatus.date}</span>
			{/if}
			{#if balance.lastPaymentDate}
				<span class="text-on-surface-variant">Último pago:</span>
				<span class="font-mono text-brand-navy tabular-nums"
					>{balance.lastPaymentDate.slice(0, 10)}</span
				>
			{/if}
		</div>
	</div>
</section>
