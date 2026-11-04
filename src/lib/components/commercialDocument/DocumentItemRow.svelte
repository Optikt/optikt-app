<script lang="ts">
	/**
	 * White card row for a commercial-document item (parent).
	 * Whole row opens the editor; trash is always visible and removal is
	 * restorable. No chevron buttons: clicking the row is the affordance.
	 */
	import { ChevronRight, Undo2, Trash2 } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import { ITEM_KIND_ICONS, BADGE_TONES } from './tones';
	import { itemTotals, type DocumentItemView } from './itemView';

	interface Props {
		item: DocumentItemView;
		open?: boolean;
		/** Row tooltip (defaults reflect the removed state). */
		tooltip?: string;
		onOpen: () => void;
		onRemove?: () => void;
		onRestore?: () => void;
	}

	let { item, open = false, tooltip, onOpen, onRemove, onRestore }: Props = $props();

	const KindIcon = $derived(ITEM_KIND_ICONS[item.kind].icon);
	const chipClass = $derived(ITEM_KIND_ICONS[item.kind].chipClass);
	const totals = $derived(itemTotals(item));
	const rowTooltip = $derived(
		tooltip ??
			(item.removed ? 'Quitado: se eliminará al guardar' : 'Clic para editar este artículo')
	);
</script>

{#snippet rowTrigger({ props }: { props: Record<string, unknown> })}
	<!-- The row is clickable but is NOT role="button": it contains real <button>
	     elements (quitar / restaurar), which ARIA forbids nesting inside a
	     button. Focusable generic region with its own name + keyboard support. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- Intentional focus target: the row's keyboard «open» support (Enter/Espacio). -->
	<div
		{...props}
		tabindex="0"
		aria-label={`Editar ${item.title}`}
		onclick={onOpen}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onOpen();
			}
		}}
		class={`group mx-4 mb-2 cursor-pointer rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(21,35,70,0.06),0_2px_8px_rgba(21,35,70,0.06)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(21,35,70,0.08),0_8px_18px_rgba(21,35,70,0.1)] ${
			item.removed ? 'opacity-60' : ''
		} ${open ? 'bg-info-container/40' : ''}`}
	>
		<div class="flex items-center gap-3">
			<span class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chipClass}`}>
				<KindIcon class="h-4 w-4" />
			</span>

			<div class="min-w-0 flex-1">
				<div class="block truncate text-sm font-semibold text-on-surface">
					{item.title}
				</div>
				{#if item.subtitle}
					<div class="truncate text-[12px] text-on-surface-variant">{item.subtitle}</div>
				{/if}
				{#each item.subtitleLines ?? [] as line (line)}
					<div class="text-[12px] text-on-surface">{line}</div>
				{/each}
			</div>

			<div class="flex shrink-0 items-center gap-2.5">
				{#if (item.quantity ?? 1) > 1 && !item.removed}
					<span
						class="rounded-[4px] bg-surface-container-high px-1.5 py-px text-[12px] font-bold text-on-surface-variant tabular-nums"
					>
						×{item.quantity}
					</span>
				{/if}

				<div class="min-w-[90px] text-right">
					{#each item.badges ?? [] as badge (badge.label)}
						<span class="mb-0.5 flex items-center justify-end gap-1">
							<span
								class="rounded-[4px] px-1.5 py-px text-[9px] font-bold tracking-wide uppercase {BADGE_TONES[
									badge.tone ?? 'neutral'
								]}"
							>
								{badge.label}
							</span>
							{#if badge.tooltip}
								<InfoTooltip text={badge.tooltip} />
							{/if}
						</span>
					{/each}
					<div class="text-[15px] font-semibold text-on-surface tabular-nums">
						{#if item.removed}<s class="font-medium">{formatPrice(totals.net)}</s
							>{:else}{formatPrice(totals.net)}{/if}
					</div>
					{#if totals.discount > 0 && !item.removed}
						<div class="text-[12px] font-medium text-error tabular-nums">
							−{formatPrice(totals.discount)}
						</div>
					{/if}
				</div>

				{#if item.removed}
					{#snippet restoreTrigger({ props }: { props: Record<string, unknown> })}
						<button
							{...props}
							type="button"
							onclick={(event) => {
								event.stopPropagation();
								onRestore?.();
							}}
							class="flex h-[30px] items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2 text-[12px] font-semibold text-on-surface-variant transition hover:bg-surface-container-low"
						>
							<Undo2 class="h-3.5 w-3.5" /> Restaurar
						</button>
					{/snippet}
					<TriggerTooltip text="Restaurar el artículo" side="left" trigger={restoreTrigger} />
				{:else if onRemove}
					<div class="flex items-center gap-0.5">
						{#snippet removeTrigger({ props }: { props: Record<string, unknown> })}
							<button
								{...props}
								type="button"
								onclick={(event) => {
									event.stopPropagation();
									onRemove?.();
								}}
								aria-label="Quitar"
								class="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-error-container hover:text-error"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{/snippet}
						<TriggerTooltip
							text="Quitar artículo (podrás restaurarlo)"
							side="left"
							trigger={removeTrigger}
						/>

						<span
							class="grid h-6 w-5 place-items-center text-outline transition-colors group-hover:translate-x-[3px] group-hover:text-brand-blue"
						>
							<ChevronRight class="h-[18px] w-[18px]" />
						</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<TriggerTooltip text={rowTooltip} side="top" trigger={rowTrigger} />
