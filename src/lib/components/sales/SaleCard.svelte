<script lang="ts">
	import { resolve } from '$app/paths';
	import { MoreHorizontal, Sparkles, Truck } from '@lucide/svelte';
	import SaleStatusBadge from '$lib/components/ui/badges/SaleStatusBadge.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import CasheaIsotipo from '$lib/components/branding/CasheaIsotipo.svelte';
	import SaleBalanceCell from '$lib/components/sales/SaleBalanceCell.svelte';
	import SaleRowMenu from '$lib/components/sales/SaleRowMenu.svelte';
	import {
		formatOrderNumber,
		relativeDaysLabel,
		saleCustomerName
	} from '$lib/components/sales/saleDisplay';
	import { isSaleCancelled } from '$lib/shared/saleBalance';
	import type { UserRole } from '$lib/shared/enums';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleListItem;
		/** Posición para el stagger de entrada (25–30 ms por tarjeta). */
		index?: number;
		/** 'comfortable' (Cuadros, rica) | 'compact' (móvil Lista, fila densa ~88 px). */
		density?: 'comfortable' | 'compact';
		canManage: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onOpen: (sale: SaleListItem) => void;
		onCancel: (sale: SaleListItem) => void;
		/** Móvil: en vez del popover, abre la hoja inferior de acciones. */
		onMenu?: (sale: SaleListItem) => void;
	}

	let {
		sale,
		index = 0,
		density = 'comfortable',
		canManage,
		currentUserId,
		currentUserRole,
		onOpen,
		onCancel,
		onMenu
	}: Props = $props();

	const compact = $derived(density === 'compact');
	const cancelled = $derived(isSaleCancelled(sale));
	const faded = $derived(cancelled ? 'opacity-[0.65]' : '');
</script>

<!-- La accesibilidad la garantiza el enlace del número de orden dentro de la tarjeta (spec §6.4). -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article
	class="animate-rise cursor-pointer rounded-[var(--ds-radius-lg)] shadow-[var(--ds-shadow-sm)] transition-all duration-200 ease-out active:bg-surface-container-low {compact
		? 'p-2.5 pr-1'
		: 'p-3 hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-md)]'} {cancelled
		? 'bg-[#fbfafb]'
		: 'bg-white'}"
	style="animation-delay: {index * 30}ms"
	onclick={() => onOpen(sale)}
>
	<!-- Fila superior: # + Cashea + flags … pill + ⋯ -->
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
		{#if sale.hasShippingPending}
			<TriggerTooltip text="Envío pendiente de registrar">
				{#snippet trigger({ props })}
					<span
						{...props}
						class="inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[var(--ds-radius-sm)] bg-warning-container text-on-warning-container"
						role="img"
						aria-label="Envío pendiente de registrar"
					>
						<Truck class="h-3.5 w-3.5" />
					</span>
				{/snippet}
			</TriggerTooltip>
		{/if}
		{#if sale.hasFreeItem}
			<TriggerTooltip text="Tiene un ítem libre">
				{#snippet trigger({ props })}
					<span
						{...props}
						class="inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[var(--ds-radius-sm)] bg-purple-container text-on-purple-container"
						role="img"
						aria-label="Tiene un ítem libre"
					>
						<Sparkles class="h-3.5 w-3.5" />
					</span>
				{/snippet}
			</TriggerTooltip>
		{/if}

		<span class="flex-1"></span>

		<SaleStatusBadge status={sale.status} />
		<div class="-my-2 -mr-1">
			{#if onMenu}
				<!-- Móvil: ⋯ de 44×44 que abre la hoja inferior de acciones (no popover). -->
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onMenu(sale);
					}}
					aria-label="Más acciones para la venta {formatOrderNumber(sale.orderNumber)}"
					class="grid h-11 w-11 place-items-center rounded-[var(--ds-radius-md)] text-brand-navy transition-colors hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
				>
					<MoreHorizontal class="h-[22px] w-[22px]" />
				</button>
			{:else}
				<SaleRowMenu
					{sale}
					{canManage}
					{currentUserId}
					{currentUserRole}
					size={compact ? 'lg' : 'sm'}
					{onCancel}
				/>
			{/if}
		</div>
	</div>

	<!-- Cliente + saldo -->
	{#if compact}
		<div class="mt-0.5 flex items-end gap-2.5 pr-2">
			<div class="min-w-0 flex-1 {faded}">
				<p class="text-[14px] leading-tight font-semibold text-on-surface">
					{saleCustomerName(sale)}
				</p>
				<p class="mt-0.5 truncate text-[12px] text-on-surface-variant">
					{#if sale.customer?.idNumber}
						<span class="font-mono">{sale.customer.idNumber}</span> ·
					{/if}
					{relativeDaysLabel(sale.saleDate)}
				</p>
			</div>
			<!-- Bloque de saldo fijo 116 px (barra naranja + N% cobrado), como el mockup -->
			<div class="w-[116px] shrink-0">
				<SaleBalanceCell {sale} />
			</div>
		</div>
	{:else}
		<div class="mt-2 {faded}">
			<p class="text-[14px] leading-tight font-semibold text-on-surface">
				{saleCustomerName(sale)}
			</p>
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
	{/if}
</article>
