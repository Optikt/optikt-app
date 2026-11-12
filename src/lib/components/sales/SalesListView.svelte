<script lang="ts">
	import { resolve } from '$app/paths';
	import { Sparkles, Truck } from '@lucide/svelte';
	import SaleStatusBadge from '$lib/components/ui/badges/SaleStatusBadge.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
	import SaleBalanceCell from '$lib/components/sales/SaleBalanceCell.svelte';
	import SaleRowMenu from '$lib/components/sales/SaleRowMenu.svelte';
	import {
		formatOrderNumber,
		relativeDaysLabel,
		saleListStatusLabel
	} from '$lib/components/sales/saleDisplay';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import { isSaleCancelled } from '$lib/shared/saleBalance';
	import type { UserRole } from '$lib/shared/enums';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sales: SaleListItem[];
		canManage: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onOpen: (sale: SaleListItem) => void;
		onCancel: (sale: SaleListItem) => void;
	}

	let { sales, canManage, currentUserId, currentUserRole, onOpen, onCancel }: Props = $props();

	const headerCell =
		'px-3 py-1 text-left text-[11px] leading-tight font-bold tracking-[0.06em] uppercase text-on-surface-variant';
	const cell = 'px-3 align-middle';

	function customerName(sale: SaleListItem): string {
		if (!sale.customer) return '-';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}

	function initials(fullName: string): string {
		return (
			fullName
				.split(' ')
				.filter(Boolean)
				.slice(0, 2)
				.map((chunk) => chunk[0]?.toUpperCase() ?? '')
				.join('') || '?'
		);
	}
</script>

<table class="w-full table-fixed border-collapse" aria-label="Listado de ventas">
	<thead>
		<tr class="h-[30px] border-b border-outline-variant/70 bg-surface-container-low">
			<th class="{headerCell} w-[96px]">#</th>
			<th class={headerCell}>Cliente</th>
			<th class="{headerCell} w-[96px]">Fecha</th>
			<th class="{headerCell} w-[100px] text-right">Total</th>
			<th class="{headerCell} w-[176px] text-right">Saldo pendiente</th>
			<th class="{headerCell} w-[124px]">Estado</th>
			<th class="{headerCell} hidden w-[150px] @min-[1130px]:table-cell">Vendedor</th>
			<th class="{headerCell} w-[44px] text-right">
				<span class="sr-only">Acciones</span>
			</th>
		</tr>
	</thead>

	<tbody class="divide-y divide-outline-variant/40">
		{#each sales as sale, index (sale.id)}
			{@const cancelled = isSaleCancelled(sale)}
			{@const faded = cancelled ? 'opacity-60' : ''}
			<tr
				class="animate-rise h-[58px] cursor-pointer bg-white transition-colors duration-150 hover:bg-surface-container-low"
				style="animation-delay: {index * 25}ms"
				onclick={() => onOpen(sale)}
			>
				<!-- # orden + Cashea -->
				<td class="{cell} {faded}">
					<div class="flex items-center gap-1.5">
						<a
							href={resolve(`/sales/${sale.id}`)}
							onclick={(event) => event.stopPropagation()}
							class="font-mono text-[14px] font-bold text-brand-navy transition-colors hover:text-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
						>
							{formatOrderNumber(sale.orderNumber)}
						</a>
						{#if sale.isCashea}
							<TriggerTooltip text="Venta con Cashea">
								{#snippet trigger({ props })}
									<span
										{...props}
										class="inline-flex shrink-0 items-center"
										aria-label="Venta con Cashea"
									>
										<CasheaIsotipo class="h-[18px] w-[18px]" />
									</span>
								{/snippet}
							</TriggerTooltip>
						{/if}
					</div>
				</td>

				<!-- Cliente -->
				<td class="{cell} {faded}">
					<p class="text-[14px] leading-tight font-semibold text-on-surface">
						{customerName(sale)}
					</p>
					{#if sale.customer?.idNumber}
						<p class="mt-0.5 font-mono text-[12px] text-on-surface-variant">
							{sale.customer.idNumber}
						</p>
					{/if}
				</td>

				<!-- Fecha -->
				<td class="{cell} {faded}">
					<p class="text-[13px] whitespace-nowrap text-on-surface tabular-nums">
						{formatDateOnly(sale.saleDate, { day: '2-digit', month: '2-digit', year: '2-digit' })}
					</p>
					<p class="mt-0.5 text-[11px] whitespace-nowrap text-outline">
						{relativeDaysLabel(sale.saleDate)}
					</p>
				</td>

				<!-- Total -->
				<td class="{cell} {faded} text-right">
					<span class="font-heading text-[15px] font-semibold text-brand-navy tabular-nums">
						{formatPrice(sale.total)}
					</span>
				</td>

				<!-- Saldo pendiente -->
				<td class="{cell} {faded}">
					<SaleBalanceCell {sale} />
				</td>

				<!-- Estado (+ flags debajo, como en el mockup) -->
				<td class={cell}>
					<div class="flex flex-col items-start gap-1">
						<SaleStatusBadge
							status={sale.status}
							label={saleListStatusLabel(sale.status)}
							class="whitespace-nowrap"
						/>
						{#if sale.hasShippingPending || sale.hasFreeItem}
							<div class="flex gap-1">
								{#if sale.hasShippingPending}
									<span
										class="inline-grid h-5 w-5 place-items-center rounded-[var(--ds-radius-sm)] bg-warning-container text-on-warning-container"
										role="img"
										aria-label="Envío pendiente de registrar"
									>
										<Truck class="h-3 w-3" />
									</span>
								{/if}
								{#if sale.hasFreeItem}
									<span
										class="inline-grid h-5 w-5 place-items-center rounded-[var(--ds-radius-sm)] bg-purple-container text-on-purple-container"
										role="img"
										aria-label="Tiene un ítem libre"
									>
										<Sparkles class="h-3 w-3" />
									</span>
								{/if}
							</div>
						{/if}
					</div>
				</td>

				<!-- Vendedor (solo con ancho suficiente) -->
				<td class="{cell} hidden @min-[1130px]:table-cell">
					<div class="flex items-center gap-2">
						<span
							class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
						>
							{initials(sale.seller?.fullName ?? '')}
						</span>
						<span class="truncate text-[13px] text-on-surface-variant">
							{sale.seller?.fullName ?? '-'}
						</span>
					</div>
				</td>

				<!-- Acciones -->
				<td class="{cell} text-right">
					<div class="flex justify-end">
						<SaleRowMenu {sale} {canManage} {currentUserId} {currentUserRole} {onCancel} />
					</div>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
