<script lang="ts">
	import { Ban, Check } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import {
		isSaleCancelled,
		saleBalance,
		saleIsPaid,
		salePaymentPercent
	} from '$lib/shared/saleBalance';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleListItem;
		/** Tarjeta (cuadros/mobile): etiqueta superior, monto grande y layout propio. */
		card?: boolean;
	}

	let { sale, card = false }: Props = $props();

	const cancelled = $derived(isSaleCancelled(sale));
	const paid = $derived(saleIsPaid(sale));
	const percent = $derived(salePaymentPercent(sale));
	const balance = $derived(saleBalance(sale));
	const barClass = $derived(card ? 'h-1.5' : 'h-[5px]');
</script>

{#if card}
	<!-- ── Tarjeta (vista Cuadros / mobile) ───────────────────────────── -->
	<div class="w-full min-w-0">
		<p class="text-[10px] font-bold tracking-[0.1em] text-on-surface-variant uppercase">
			Saldo pendiente
		</p>

		{#if cancelled}
			<div class="mt-0.5 text-[16px] font-medium text-on-surface-variant tabular-nums line-through">
				{formatPrice(sale.total)}
			</div>
			<div
				class="mt-1.5 {barClass} w-full rounded-[3px] border border-dashed border-outline-variant"
				aria-hidden="true"
			></div>
			<p class="mt-1 flex items-center gap-1 text-[11px] font-bold text-on-error-container">
				<Ban class="h-3 w-3 shrink-0" />
				Venta cancelada · sin saldo
			</p>
		{:else if paid}
			<div class="mt-0.5 flex items-baseline justify-between gap-2">
				<span class="text-[16px] font-bold text-on-success-container">✓ Pagado</span>
				<span class="text-[12px] text-on-surface-variant tabular-nums">
					{formatPrice(sale.total)}
				</span>
			</div>
			<div class="mt-1.5 {barClass} w-full overflow-hidden rounded-[3px] bg-surface-container-high">
				<div class="h-full rounded-[3px] bg-success" style="width: 100%"></div>
			</div>
		{:else}
			<div class="mt-0.5 flex items-baseline justify-between gap-2">
				<TriggerTooltip
					text="Cobrado {formatPrice(sale.paidAmountBcvUsd)} de {formatPrice(sale.total)}"
				>
					{#snippet trigger({ props })}
						<span
							{...props}
							class="font-heading text-[24px] leading-none font-bold text-brand-navy tabular-nums"
						>
							{formatPrice(balance)}
						</span>
					{/snippet}
				</TriggerTooltip>
				<span class="text-[12px] text-on-surface-variant tabular-nums">
					de {formatPrice(sale.total)}
				</span>
			</div>
			<div class="mt-1.5 {barClass} w-full overflow-hidden rounded-[3px] bg-surface-container-high">
				<div
					class="h-full rounded-[3px] bg-warning transition-[width] duration-300 ease-out"
					style="width: {percent}%"
				></div>
			</div>
			<p class="mt-1 text-[12px] text-on-surface-variant tabular-nums">{percent}% cobrado</p>
		{/if}
	</div>
{:else}
	<!-- ── Celda de fila (vista Lista) ─────────────────────────────────── -->
	<div class="w-full min-w-0">
		{#if cancelled}
			<div
				class="text-right text-[13px] font-medium text-on-surface-variant tabular-nums line-through"
			>
				{formatPrice(sale.total)}
			</div>
			<div
				class="mt-1 {barClass} w-full rounded-[3px] border border-dashed border-outline-variant"
				aria-hidden="true"
			></div>
			<div
				class="mt-1 flex items-center justify-end gap-1 text-[11px] font-bold text-on-error-container"
			>
				<Ban class="h-3 w-3 shrink-0" />
				Cancelada · sin saldo
			</div>
		{:else if paid}
			<div
				class="flex items-center justify-end gap-1 text-[13px] font-bold text-on-success-container"
			>
				<Check class="h-3.5 w-3.5 shrink-0" />
				Pagado
			</div>
			<div class="mt-1 {barClass} w-full overflow-hidden rounded-[3px] bg-surface-container-high">
				<div class="h-full rounded-[3px] bg-success" style="width: 100%"></div>
			</div>
			<div class="mt-1 text-right text-[11px] text-on-surface-variant tabular-nums">
				{formatPrice(sale.total)}
			</div>
		{:else}
			<TriggerTooltip
				text="Cobrado {formatPrice(sale.paidAmountBcvUsd)} de {formatPrice(sale.total)}"
			>
				{#snippet trigger({ props })}
					<div
						{...props}
						class="font-heading text-right text-[16px] font-bold text-brand-navy tabular-nums"
					>
						{formatPrice(balance)}
					</div>
				{/snippet}
			</TriggerTooltip>

			<div class="mt-1 {barClass} w-full overflow-hidden rounded-[3px] bg-surface-container-high">
				<div
					class="h-full rounded-[3px] bg-warning transition-[width] duration-300 ease-out"
					style="width: {percent}%"
				></div>
			</div>
			<div class="mt-1 text-right text-[11px] text-on-surface-variant tabular-nums">
				{percent}% cobrado
			</div>
		{/if}
	</div>
{/if}
