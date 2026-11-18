<script lang="ts">
	import { goto } from '$app/navigation';
	import { X } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import {
		SALE_ROW_ACTION_ICONS,
		saleRowActionHref,
		saleRowActions,
		type SaleRowActionId
	} from './saleRowActions';
	import { formatOrderNumber, saleCustomerName, saleListStatusLabel } from './saleDisplay';
	import { formatPrice } from '$lib/utils';
	import { saleBalance } from '$lib/shared/saleBalance';
	import type { UserRole } from '$lib/shared/enums';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	/**
	 * Hoja inferior de acciones del ⋯ en móvil (no popover).
	 * Mismo gating, hrefs e iconos que `SaleRowMenu` (helper `saleRowActions`);
	 * cancelar delega en `CancelSaleModal` del listado. El cierre notifica vía
	 * `onclose` (el estado vive en la página) — el `open` de SlideOver queda local.
	 */
	interface Props {
		open: boolean;
		sale: SaleListItem | null;
		canManage: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onCancel: (sale: SaleListItem) => void;
		onclose: () => void;
	}

	let { open, sale, canManage, currentUserId, currentUserRole, onCancel, onclose }: Props =
		$props();

	const actions = $derived(
		sale ? saleRowActions(sale, { canManage, currentUserId, currentUserRole }) : []
	);
	const balance = $derived(sale ? saleBalance(sale) : 0);

	function run(id: SaleRowActionId): void {
		if (!sale) return;
		onclose();
		// Cancel no navega: abre CancelSaleModal en el listado.
		if (id === 'cancel') {
			onCancel(sale);
			return;
		}
		// `saleRowActionHref` resuelve con `resolve()` internamente.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(saleRowActionHref(sale, id));
	}
</script>

<SlideOver {open} direction="bottom" dragClose closeOnVeil {onclose}>
	{#snippet header()}
		<div
			class="flex items-start justify-between gap-3 border-b border-outline-variant/50 px-4 pb-3"
		>
			<div class="min-w-0">
				{#if sale}
					<p class="font-mono text-[14px] font-bold text-brand-navy">
						{formatOrderNumber(sale.orderNumber)} · {saleCustomerName(sale)}
					</p>
					<p class="mt-0.5 text-[12px] text-on-surface-variant">
						{saleListStatusLabel(sale.status)} · saldo
						{formatPrice(balance)}
					</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={onclose}
				aria-label="Cerrar acciones"
				class="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--ds-radius-md)] text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="flex flex-col gap-0.5 p-2">
		{#each actions as action (action.id)}
			{@const Icon = SALE_ROW_ACTION_ICONS[action.id]}
			{#if action.id === 'cancel'}
				<hr class="my-1.5 border-outline-variant/60" />
			{/if}
			<button
				type="button"
				onclick={() => run(action.id)}
				class="flex min-h-[54px] w-full items-center gap-3 rounded-[var(--ds-radius-md)] px-3 text-left text-[15px] font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none {action.danger
					? 'text-on-error-container'
					: ''}"
			>
				<Icon class="h-[22px] w-[22px] shrink-0 {action.danger ? '' : 'text-outline'}" />
				<span class="flex flex-col gap-0.5">
					<span>{action.label}</span>
					{#if action.description}
						<span class="text-[12px] font-normal text-on-surface-variant">
							{action.description}
						</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>
</SlideOver>
