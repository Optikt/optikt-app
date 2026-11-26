<script lang="ts">
	import {
		CircleX,
		Copy,
		EllipsisVertical,
		FileDown,
		History,
		Pen,
		ReceiptText,
		X
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import { QuoteStatus } from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';
	import { formatConvertedSaleRef } from '$lib/components/quotes/list/quoteListDisplay';

	interface Props {
		quote: QuoteWithRelations;
		/** Cualquier rol excepto VIEWER. */
		canAct: boolean;
		onEdit: () => void;
		onDuplicate: () => void;
		onPrintPdf: () => void;
		onCancel: () => void;
		onConvert: () => void;
		onOpenHistory: () => void;
	}

	let {
		quote,
		canAct,
		onEdit,
		onDuplicate,
		onPrintPdf,
		onCancel,
		onConvert,
		onOpenHistory
	}: Props = $props();

	const isDraft = $derived(quote.status === QuoteStatus.DRAFT);
	const isConverted = $derived(quote.status === QuoteStatus.CONVERTED);

	/** La barra solo existe con una acción primaria (espec: sin barra vacía). */
	const showBar = $derived(canAct && (isDraft || (isConverted && !!quote.conversionSaleId)));

	let sheetOpen = $state(false);

	function run(action: () => void) {
		sheetOpen = false;
		action();
	}
</script>

{#if showBar}
	<div
		class="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/60 bg-surface-container-lowest/95 backdrop-blur print:hidden"
	>
		<div
			class="mx-auto flex w-full max-w-[1760px] items-center gap-2 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
		>
			{#if canAct && isDraft}
				<button
					type="button"
					onclick={onConvert}
					class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-gold text-[15px] font-bold text-brand-navy transition-transform duration-150 active:scale-[.98]"
				>
					Convertir a venta
				</button>
			{:else if isConverted && quote.convertedOrderNumber}
				<button
					type="button"
					onclick={() => goto(resolve(`/sales/${quote.conversionSaleId ?? ''}`))}
					class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-navy text-[15px] font-bold text-white"
				>
					<ReceiptText class="h-4 w-4" />
					Ver venta {formatConvertedSaleRef(quote.convertedOrderNumber)}
				</button>
			{/if}
			{#if canAct}
				<button
					type="button"
					onclick={() => (sheetOpen = true)}
					aria-haspopup="dialog"
					class="inline-flex h-11 items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-4 text-[15px] font-semibold text-on-surface"
				>
					<EllipsisVertical class="h-4 w-4" />
					Más
				</button>
			{/if}
		</div>
	</div>
{/if}

<SlideOver bind:open={sheetOpen} direction="bottom">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between px-5 pt-3 pb-2">
			<h2 class="font-heading text-base font-bold text-brand-navy">Acciones del presupuesto</h2>
			<button
				type="button"
				onclick={onclose}
				aria-label="Cerrar acciones"
				class="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
		{#if canAct && isDraft}
			<button
				type="button"
				onclick={() => run(onEdit)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Pen class="h-4 w-4" />
				</span>
				<span class="flex flex-col gap-0.5">
					<span class="text-sm font-semibold text-on-surface">Editar</span>
					<span class="text-[13px] text-on-surface-variant">Ítems, descuento, Cashea, validez</span>
				</span>
			</button>
		{/if}
		{#if canAct}
			<button
				type="button"
				onclick={() => run(onDuplicate)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<Copy class="h-4 w-4" />
				</span>
				<span class="flex flex-col gap-0.5">
					<span class="text-sm font-semibold text-on-surface">Duplicar</span>
					<span class="text-[13px] text-on-surface-variant">
						Nuevo presupuesto para otro cliente
					</span>
				</span>
			</button>
			<button
				type="button"
				onclick={() => run(onPrintPdf)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<FileDown class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Imprimir PDF</span>
			</button>
			<button
				type="button"
				onclick={() => run(onOpenHistory)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container-high"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<History class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-on-surface">Ver historial</span>
			</button>
		{/if}
		{#if canAct && isDraft}
			<div class="mx-3 my-1.5 h-px bg-outline-variant/40"></div>
			<button
				type="button"
				onclick={() => run(onCancel)}
				class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-error-container"
			>
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-error-container text-on-error-container"
				>
					<CircleX class="h-4 w-4" />
				</span>
				<span class="text-sm font-semibold text-error">Cancelar presupuesto</span>
			</button>
		{/if}
	</div>
</SlideOver>
