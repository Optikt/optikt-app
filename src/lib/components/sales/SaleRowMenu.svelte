<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { DropdownMenu } from 'bits-ui';
	import { CircleX, Eye, MoreHorizontal, Play, Wallet } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { SaleStatus, canManageSaleByOwner, type UserRole } from '$lib/shared/enums';
	import { isSaleCancelled, saleHasBalance } from '$lib/shared/saleBalance';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleListItem;
		/** `canOperate(role)` del listado (VIEWER = false). */
		canManage: boolean;
		currentUserId?: string;
		currentUserRole?: UserRole;
		onCancel: (sale: SaleListItem) => void;
	}

	let { sale, canManage, currentUserId, currentUserRole, onCancel }: Props = $props();

	const canPay = $derived(canManage && !isSaleCancelled(sale) && saleHasBalance(sale));
	// Spec: el menú no ofrece cambiar estado en canceladas ni completadas.
	const canChangeStatus = $derived(
		canManage && sale.status !== SaleStatus.CANCELLED && sale.status !== SaleStatus.COMPLETED
	);
	const canCancel = $derived(
		canManage &&
			sale.status === SaleStatus.PENDING &&
			canManageSaleByOwner(currentUserRole, currentUserId, sale.sellerId)
	);

	const itemClass =
		'flex w-full cursor-pointer items-start gap-2.5 rounded-[var(--ds-radius-md)] px-2.5 py-2 text-left text-[13px] font-semibold text-on-surface outline-none select-none data-[highlighted]:bg-surface-container-low';

	function goDetail(): void {
		void goto(resolve(`/sales/${sale.id}`));
	}

	function goPay(): void {
		void goto(resolve(`/sales/${sale.id}?action=pay`));
	}

	function goStatus(): void {
		void goto(resolve(`/sales/${sale.id}?action=status`));
	}
</script>

<DropdownMenu.Root>
	<TriggerTooltip text="Más acciones" side="left">
		{#snippet trigger({ props })}
			<div {...props}>
				<DropdownMenu.Trigger
					aria-label="Más acciones"
					class="grid h-[34px] w-[34px] place-items-center rounded-[var(--ds-radius-md)] text-brand-navy transition-colors duration-150 hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
				>
					<MoreHorizontal class="h-[18px] w-[18px]" />
				</DropdownMenu.Trigger>
			</div>
		{/snippet}
	</TriggerTooltip>

	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={6}
			class="data-[state=open]:animate-pop z-[70] w-64 origin-top-right rounded-[var(--ds-radius-lg)] border border-outline-variant/30 bg-white p-1.5 shadow-[var(--ds-shadow-lg)]"
		>
			<DropdownMenu.Item class={itemClass} onSelect={goDetail}>
				<Eye class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
				Ver detalle
			</DropdownMenu.Item>

			{#if canPay}
				<DropdownMenu.Item class={itemClass} onSelect={goPay}>
					<Wallet class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					<span class="flex flex-col gap-0.5">
						<span>Registrar pago</span>
						<span class="text-[11px] font-normal text-on-surface-variant">
							Abre la venta y su drawer de pago
						</span>
					</span>
				</DropdownMenu.Item>
			{/if}

			{#if canChangeStatus}
				<DropdownMenu.Item class={itemClass} onSelect={goStatus}>
					<Play class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					<span class="flex flex-col gap-0.5">
						<span>Cambiar estado</span>
						<span class="text-[11px] font-normal text-on-surface-variant">
							Abre la venta y el modal de estado
						</span>
					</span>
				</DropdownMenu.Item>
			{/if}

			{#if canCancel}
				<DropdownMenu.Separator class="my-1 h-px bg-outline-variant/60" />
				<DropdownMenu.Item
					class="{itemClass} text-on-error-container data-[highlighted]:bg-error-container"
					onSelect={() => onCancel(sale)}
				>
					<CircleX class="mt-0.5 h-4 w-4 shrink-0" />
					Cancelar venta
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
