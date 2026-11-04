<script lang="ts">
	/**
	 * White child card (treatment) under its parent lens row, with the
	 * tree connector drawn as CSS pseudo-elements (corner + continuous
	 * line between siblings). Whole row opens the parent editor.
	 */
	import { X } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import { ITEM_KIND_ICONS, BADGE_TONES } from './tones';
	import type { DocumentChildView } from './itemView';

	interface Props {
		child: DocumentChildView;
		/** True when this is the last child of its parent (closes the connector). */
		last?: boolean;
		tooltip?: string;
		onOpen: () => void;
		onRemove?: () => void;
	}

	let { child, last = false, tooltip, onOpen, onRemove }: Props = $props();

	const KindIcon = $derived(ITEM_KIND_ICONS[child.kind].icon);
	const rowTooltip = $derived(tooltip ?? 'Clic para editar los tratamientos de este cristal');
</script>

{#snippet childRow({ props }: { props: Record<string, unknown> })}
	<div
		{...props}
		role="button"
		tabindex="0"
		aria-label={child.title}
		onclick={onOpen}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onOpen();
			}
		}}
		class={`group child-connector ${last ? 'child-last' : ''} relative ml-[60px] flex cursor-pointer rounded-xl bg-white pt-2 pr-2 pb-2 pl-3 shadow-[0_1px_2px_rgba(21,35,70,0.06),0_2px_8px_rgba(21,35,70,0.06)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(21,35,70,0.08),0_8px_18px_rgba(21,35,70,0.1)]`}
	>
		<span
			class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ITEM_KIND_ICONS[child.kind].chipClass}`}
		>
			<KindIcon class="h-3.5 w-3.5" />
		</span>

		<div class="min-w-0 flex-1">
			<div class="block truncate text-sm font-semibold text-on-surface">{child.title}</div>
			<div class="mt-0.5 flex items-center gap-1.5">
				<span
					class={`rounded-[4px] px-[7px] py-px text-[10px] font-bold tracking-[0.06em] uppercase ${BADGE_TONES.neutral}`}
				>
					Tratamiento
				</span>
				<span
					class={`rounded-[4px] px-[7px] py-px text-[10px] font-bold tracking-[0.06em] uppercase ${BADGE_TONES.info}`}
				>
					{child.tag}
				</span>
			</div>
		</div>

		<span
			class="shrink-0 rounded-[4px] bg-surface-container-high px-1.5 py-px text-[12px] font-bold text-on-surface-variant tabular-nums"
		>
			×{child.quantity}
		</span>

		<div class="shrink-0 text-right">
			<div class="text-[14px] font-semibold text-on-surface tabular-nums">
				{formatPrice(child.unitPrice * child.quantity)}
			</div>
			<div class="text-[12px] font-medium text-on-surface-variant tabular-nums">
				{child.unitPriceLabel}
			</div>
		</div>

		{#if onRemove}
			{#snippet removeTrigger({ props }: { props: Record<string, unknown> })}
				<button
					{...props}
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onRemove?.();
					}}
					aria-label="Quitar tratamiento"
					class="ml-1 flex h-[34px] w-[34px] items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-error-container hover:text-error"
				>
					<X class="h-[15px] w-[15px]" />
				</button>
			{/snippet}
			<TriggerTooltip text="Quitar este tratamiento" side="left" trigger={removeTrigger} />
		{/if}
	</div>
{/snippet}

<TriggerTooltip text={rowTooltip} side="top" trigger={childRow} />

<style>
	/* Tree connector: elbow from the parent down to this card, then a
	   continuous vertical line while more siblings follow. */
	.child-connector::before {
		content: '';
		position: absolute;
		left: -14px;
		top: -6px;
		width: 14px;
		height: calc(50% + 6px);
		border-left: 2px solid var(--color-outline-variant);
		border-bottom: 2px solid var(--color-outline-variant);
		border-bottom-left-radius: 8px;
	}
	.child-connector:not(.child-last)::after {
		content: '';
		position: absolute;
		left: -14px;
		top: 50%;
		bottom: -6px;
		border-left: 2px solid var(--color-outline-variant);
	}
</style>
