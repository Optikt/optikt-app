<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { DropdownMenu } from 'bits-ui';
	import { ArrowRightLeft, CircleX, Copy, Ellipsis, Eye, Pen } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quote: QuoteWithRelations;
		/** `canOperate(role)` del listado (VIEWER = false). */
		canManage: boolean;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
	}

	let { quote, canManage, onEdit, onDuplicate, onConvert, onCancel }: Props = $props();

	// D7: duplicar desde cualquier estado. Editar/convertir/cancelar: solo DRAFT.
	const isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	const canEdit = $derived(canManage && isDraft);
	const canConvert = $derived(canManage && isDraft);
	const canCancel = $derived(canManage && isDraft);

	const itemClass =
		'flex w-full cursor-pointer items-start gap-2.5 rounded-[var(--ds-radius-md)] px-2.5 py-2 text-left text-[13px] font-semibold text-on-surface outline-none select-none data-[highlighted]:bg-surface-container-low';

	function goDetail(): void {
		void goto(resolve(`/quotes/${quote.id}`));
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
			<DropdownMenu.Item class={itemClass} onSelect={goDetail}>
				<Eye class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
				Ver detalle
			</DropdownMenu.Item>

			{#if canEdit}
				<DropdownMenu.Item class={itemClass} onSelect={() => onEdit(quote)}>
					<Pen class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					Editar
				</DropdownMenu.Item>
			{/if}

			{#if canConvert}
				<DropdownMenu.Item class={itemClass} onSelect={() => onConvert(quote)}>
					<ArrowRightLeft class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					Convertir a venta
				</DropdownMenu.Item>
			{/if}

			{#if canManage}
				<DropdownMenu.Item class={itemClass} onSelect={() => onDuplicate(quote)}>
					<Copy class="mt-0.5 h-4 w-4 shrink-0 text-outline" />
					<span class="flex flex-col gap-0.5">
						<span>Duplicar</span>
						<span class="text-[11px] font-normal text-on-surface-variant">
							Nuevo presupuesto con los mismos ítems
						</span>
					</span>
				</DropdownMenu.Item>
			{/if}

			{#if canCancel}
				<DropdownMenu.Separator class="my-1 h-px bg-outline-variant/60" />
				<DropdownMenu.Item
					class="{itemClass} text-on-error-container data-[highlighted]:bg-error-container"
					onSelect={() => onCancel(quote)}
				>
					<CircleX class="mt-0.5 h-4 w-4 shrink-0" />
					Cancelar presupuesto
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
