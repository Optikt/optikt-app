<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { Ellipsis } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		QUOTE_ROW_ACTION_ICONS,
		quoteRowActions,
		type QuoteRowActionId
	} from './quoteRowActions';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';

	interface Props {
		quote: QuoteWithRelations;
		/** `canOperate(role)` del listado (VIEWER = false). */
		canManage: boolean;
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
	}

	let { quote, canManage, onOpen, onEdit, onDuplicate, onConvert, onCancel }: Props = $props();

	// Gating único (D7) compartido con la hoja móvil.
	const actions = $derived(quoteRowActions(quote, canManage));

	const HANDLERS: Record<QuoteRowActionId, (q: QuoteWithRelations) => void> = $derived({
		detail: onOpen,
		edit: onEdit,
		convert: onConvert,
		duplicate: onDuplicate,
		cancel: onCancel
	});

	const itemClass =
		'flex w-full cursor-pointer items-start gap-2.5 rounded-[var(--ds-radius-md)] px-2.5 py-2 text-left text-[13px] font-semibold text-on-surface outline-none select-none data-[highlighted]:bg-surface-container-low';
</script>

<DropdownMenu.Root>
	<TriggerTooltip text="Más acciones" side="left">
		{#snippet trigger({ props })}
			<div {...props}>
				<DropdownMenu.Trigger
					aria-label="Más acciones"
					class="grid h-[34px] w-[34px] place-items-center rounded-[var(--ds-radius-md)] text-brand-navy transition-colors duration-150 hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
				>
					<Ellipsis class="h-[18px] w-[18px]" />
				</DropdownMenu.Trigger>
			</div>
		{/snippet}
	</TriggerTooltip>

	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={6}
			class="data-[state=open]:animate-pop z-[70] w-60 origin-top-right rounded-[var(--ds-radius-lg)] border border-outline-variant/30 bg-white p-1.5 shadow-[var(--ds-shadow-lg)]"
		>
			{#each actions as action (action.id)}
				{@const Icon = QUOTE_ROW_ACTION_ICONS[action.id]}
				{#if action.danger}
					<DropdownMenu.Separator class="my-1 h-px bg-outline-variant/60" />
				{/if}
				<DropdownMenu.Item
					class="{itemClass} {action.danger
						? 'text-on-error-container data-[highlighted]:bg-error-container'
						: ''}"
					onSelect={() => HANDLERS[action.id](quote)}
				>
					<Icon class="mt-0.5 h-4 w-4 shrink-0 {action.danger ? '' : 'text-outline'}" />
					{#if action.description}
						<span class="flex flex-col gap-0.5">
							<span>{action.label}</span>
							<span class="text-[11px] font-normal text-on-surface-variant">
								{action.description}
							</span>
						</span>
					{:else}
						{action.label}
					{/if}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
