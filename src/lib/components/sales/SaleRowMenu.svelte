<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { DropdownMenu } from 'bits-ui';
	import { CircleX, Eye, MoreHorizontal, Play, Wallet } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		saleRowActions,
		type SaleRowActionContext,
		type SaleRowActionId
	} from './saleRowActions';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props extends SaleRowActionContext {
		sale: SaleListItem;
		/** 'sm' (escritorio, 34 px) | 'lg' (móvil, 44 px objetivo táctil). */
		size?: 'sm' | 'lg';
		onCancel: (sale: SaleListItem) => void;
	}

	let { sale, canManage, currentUserId, currentUserRole, size = 'sm', onCancel }: Props = $props();

	const actions = $derived(saleRowActions(sale, { canManage, currentUserId, currentUserRole }));

	const itemClass =
		'flex w-full cursor-pointer items-start gap-2.5 rounded-[var(--ds-radius-md)] px-2.5 py-2 text-left text-[13px] font-semibold text-on-surface outline-none select-none data-[highlighted]:bg-surface-container-low';

	function handleAction(id: SaleRowActionId): void {
		if (id === 'detail') void goto(resolve(`/sales/${sale.id}`));
		else if (id === 'pay') void goto(resolve(`/sales/${sale.id}?action=pay`));
		else if (id === 'status') void goto(resolve(`/sales/${sale.id}?action=status`));
		else if (id === 'cancel') onCancel(sale);
	}
</script>

<DropdownMenu.Root>
	<TriggerTooltip text="Más acciones" side="left">
		{#snippet trigger({ props })}
			<div {...props}>
				<DropdownMenu.Trigger
					aria-label="Más acciones"
					class="grid {size === 'lg'
						? 'h-11 w-11'
						: 'h-[34px] w-[34px]'} place-items-center rounded-[var(--ds-radius-md)] text-brand-navy transition-colors duration-150 hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
				>
					<MoreHorizontal class={size === 'lg' ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]'} />
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
			{#each actions as action (action.id)}
				{#if action.id === 'cancel'}
					<DropdownMenu.Separator class="my-1 h-px bg-outline-variant/60" />
				{/if}
				<DropdownMenu.Item
					class="{itemClass} {action.danger
						? 'text-on-error-container data-[highlighted]:bg-error-container'
						: ''}"
					onSelect={() => handleAction(action.id)}
				>
					{#if action.id === 'detail'}
						<Eye class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					{:else if action.id === 'pay'}
						<Wallet class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					{:else if action.id === 'status'}
						<Play class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					{:else}
						<CircleX class="mt-0.5 h-4 w-4 shrink-0" />
					{/if}
					<span class="flex flex-col gap-0.5">
						<span>{action.label}</span>
						{#if action.description}
							<span class="text-[11px] font-normal text-on-surface-variant">
								{action.description}
							</span>
						{/if}
					</span>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
