<script lang="ts">
	import { X } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import {
		QUOTE_ROW_ACTION_ICONS,
		quoteRowActions,
		type QuoteRowActionId
	} from './quoteRowActions';
	import { formatQuoteNumber } from './quoteListDisplay';
	import { QUOTE_STATUS_LABELS, type QuoteStatus } from '$lib/shared/contracts/quotes';
	import { formatPrice } from '$lib/utils';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';

	/**
	 * Hoja inferior de acciones del ⋯ en móvil (no popover), como en ventas.
	 * Mismo gating e iconos que `QuoteRowMenu` (helper `quoteRowActions`).
	 * El cierre notifica vía `onclose` (el estado vive en la página).
	 */
	interface Props {
		open: boolean;
		quote: QuoteWithRelations | null;
		canManage: boolean;
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
		onclose: () => void;
	}

	let { open, quote, canManage, onOpen, onEdit, onDuplicate, onConvert, onCancel, onclose }: Props =
		$props();

	const actions = $derived(quote ? quoteRowActions(quote, canManage) : []);

	function run(id: QuoteRowActionId): void {
		if (!quote) return;
		const target = quote;
		onclose();
		const handlers: Record<QuoteRowActionId, (q: QuoteWithRelations) => void> = {
			detail: onOpen,
			edit: onEdit,
			convert: onConvert,
			duplicate: onDuplicate,
			cancel: onCancel
		};
		handlers[id](target);
	}

	function customerName(q: QuoteWithRelations): string {
		return q.customer ? `${q.customer.firstName} ${q.customer.lastName}` : 'Sin cliente';
	}
</script>

<SlideOver {open} direction="bottom" dragClose closeOnVeil {onclose}>
	{#snippet header()}
		<div
			class="flex items-start justify-between gap-3 border-b border-outline-variant/50 px-4 pb-3"
		>
			<div class="min-w-0">
				{#if quote}
					<p class="font-mono text-[14px] font-bold text-brand-navy">
						{formatQuoteNumber(quote.quoteNumber)} · {customerName(quote)}
					</p>
					<p class="mt-0.5 text-[12px] text-on-surface-variant">
						{QUOTE_STATUS_LABELS[quote.status as QuoteStatus] ?? quote.status} · total
						{formatPrice(quote.total)}
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
			{@const Icon = QUOTE_ROW_ACTION_ICONS[action.id]}
			{#if action.danger}
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
