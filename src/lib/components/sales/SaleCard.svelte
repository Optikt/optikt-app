<script lang="ts">
	import { resolve } from '$app/paths';
	import { Sparkles, Truck } from '@lucide/svelte';
	import SaleStatusBadge from '$lib/components/ui/badges/SaleStatusBadge.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
	import SaleBalanceCell from '$lib/components/sales/SaleBalanceCell.svelte';
	import SaleRowMenu from '$lib/components/sales/SaleRowMenu.svelte';
	import { formatOrderNumber, relativeDaysLabel } from '$lib/components/sales/saleDisplay';
	import { isSaleCancelled } from '$lib/shared/saleBalance';
	import type { UserRole } from '$lib/shared/enums';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleListItem;
		/** Posición para el stagger de entrada (25–30 ms por tarjeta). */
		index?: number;
		canManage: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onOpen: (sale: SaleListItem) => void;
		onCancel: (sale: SaleListItem) => void;
	}

	let {
		sale,
		index = 0,
		canManage,
		currentUserId,
		currentUserRole,
		onOpen,
		onCancel
	}: Props = $props();

	const cancelled = $derived(isSaleCancelled(sale));
	const faded = $derived(cancelled ? 'opacity-[0.65]' : '');

	function customerName(): string {
		if (!sale.customer) return '-';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}
</script>

<!-- La accesibilidad la garantiza el enlace del número de orden dentro de la tarjeta (spec §6.4). -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
	class="animate-rise cursor-pointer rounded-[var(--ds-radius-lg)] p-3 shadow-[var(--ds-shadow-sm)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-md)] {cancelled
		? 'bg-[#fbfafb]'
		: 'bg-white'}"
	style="animation-delay: {index * 30}ms"
	onclick={() => onOpen(sale)}
>
	<!-- Fila superior: # + Cashea … pill + ⋯ -->
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
					<span {...props} class="inline-flex shrink-0 items-center" aria-label="Venta con Cashea">
						<CasheaIsotipo class="h-[18px] w-[18px]" />
					</span>
				{/snippet}
			</TriggerTooltip>
		{/if}

		<span class="flex-1"></span>

		<SaleStatusBadge status={sale.status} />
		<div class="-my-1.5 -mr-1.5">
			<SaleRowMenu {sale} {canManage} {currentUserId} {currentUserRole} {onCancel} />
		</div>
	</div>

	<!-- Cliente -->
	<div class="mt-2 {faded}">
		<p class="text-[14px] leading-tight font-semibold text-on-surface">{customerName()}</p>
		<p class="mt-0.5 text-[12px] text-on-surface-variant">
			{#if sale.customer?.idNumber}
				<span class="font-mono">{sale.customer.idNumber}</span> ·
			{/if}
			{relativeDaysLabel(sale.saleDate)}
		</p>
	</div>

	<!-- Saldo (protagonista) -->
	<div class="mt-2.5 {faded}">
		<SaleBalanceCell {sale} card />
	</div>

	<!-- Flags (solo si existen: sin espacio muerto) -->
	{#if sale.hasShippingPending || sale.hasFreeItem}
		<div class="mt-2 flex gap-1.5 {faded}">
			{#if sale.hasShippingPending}
				<span
					class="inline-grid h-6 w-6 place-items-center rounded-[var(--ds-radius-sm)] bg-warning-container text-on-warning-container"
					role="img"
					aria-label="Envío pendiente de registrar"
				>
					<Truck class="h-3.5 w-3.5" />
				</span>
			{/if}
			{#if sale.hasFreeItem}
				<span
					class="inline-grid h-6 w-6 place-items-center rounded-[var(--ds-radius-sm)] bg-purple-container text-on-purple-container"
					role="img"
					aria-label="Tiene un ítem libre"
				>
					<Sparkles class="h-3.5 w-3.5" />
				</span>
			{/if}
		</div>
	{/if}
</article>
