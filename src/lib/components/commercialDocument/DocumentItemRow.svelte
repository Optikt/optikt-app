<script lang="ts">
	/**
	 * Flat item row for the commercial-document editor.
	 * Mirrors the redesign mockup: hairline row, type tag + meta, qty badge,
	 * discount amount, line total and hover actions. No chevron: clicking the
	 * row toggles the inline editor rendered by the parent.
	 */
	import { Pencil, Trash2 } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import { ITEM_TONES, BADGE_TONES } from './tones';
	import { itemTotals, type DocumentItemView } from './itemView';

	interface Props {
		item: DocumentItemView;
		open?: boolean;
		onToggle: () => void;
		onEdit?: () => void;
		onRemove?: () => void;
		disabled?: boolean;
	}

	let { item, open = false, onToggle, onEdit, onRemove, disabled = false }: Props = $props();

	const tone = $derived(ITEM_TONES[item.tone]);
	const ToneIcon = $derived(tone.icon);
	const totals = $derived(itemTotals(item));

	function toggle() {
		onToggle();
	}
</script>

<div class="group relative transition-colors" class:bg-surface-container-low={open}>
	<div
		class="flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-surface-container-low/70 dark:hover:bg-slate-800/60"
		onclick={toggle}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggle();
			}
		}}
		role="button"
		tabindex="0"
		aria-expanded={open}
	>
		<span
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] {tone.iconClass}"
		>
			<ToneIcon class="h-[18px] w-[18px]" />
		</span>

		<div class="min-w-0 flex-1">
			<div class="truncate text-[13.5px] font-semibold text-brand-navy dark:text-white">
				{item.title}
			</div>
			<div
				class="mt-0.5 flex items-center gap-1.5 overflow-hidden text-[11.5px] text-slate-500 dark:text-slate-400"
			>
				<span
					class="shrink-0 rounded px-1.5 py-px text-[9px] font-extrabold tracking-[0.06em] uppercase {tone.badgeClass}"
				>
					{item.typeLabel}
				</span>
				{#if item.subtitle}
					<span class="truncate">{item.subtitle}</span>
				{/if}
				{#if item.isNew}
					<span
						class="shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide uppercase {BADGE_TONES.success}"
						>Nuevo</span
					>
				{/if}
				{#each item.badges ?? [] as badge (badge.label)}
					<span class="inline-flex shrink-0 items-center gap-0.5">
						<span
							class="rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide uppercase {BADGE_TONES[
								badge.tone ?? 'neutral'
							]}">{badge.label}</span
						>
						{#if badge.tooltip}
							<InfoTooltip text={badge.tooltip} />
						{/if}
					</span>
				{/each}
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-2.5">
			<span
				class="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[11px] font-bold text-slate-500 tabular-nums dark:bg-slate-700 dark:text-slate-300"
			>
				×{item.quantity}
			</span>
			{#if totals.discount > 0}
				<span class="text-[11px] font-bold text-rose-600 tabular-nums dark:text-rose-400">
					−{formatPrice(totals.discount)}
				</span>
			{/if}
			<span
				class="min-w-[72px] text-right text-sm font-bold text-brand-navy tabular-nums dark:text-white"
			>
				{formatPrice(totals.net)}
			</span>

			{#if onEdit || onRemove}
				<div
					class="flex items-center gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
					class:opacity-100={open}
				>
					{#if onEdit}
						{#snippet editTrigger({ props }: { props: Record<string, unknown> })}
							<button
								{...props}
								type="button"
								onclick={(event) => {
									event.stopPropagation();
									if (!disabled) onEdit?.();
								}}
								aria-disabled={disabled}
								aria-label="Editar ítem"
								class="flex h-7 w-7 items-center justify-center rounded-[7px] text-slate-400 transition hover:bg-white hover:text-brand-navy hover:shadow-sm aria-disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-white"
							>
								<Pencil class="h-[15px] w-[15px]" />
							</button>
						{/snippet}
						<TriggerTooltip text="Editar ítem" trigger={editTrigger} />
					{/if}
					{#if onRemove}
						{#snippet removeTrigger({ props }: { props: Record<string, unknown> })}
							<button
								{...props}
								type="button"
								onclick={(event) => {
									event.stopPropagation();
									if (!disabled) onRemove?.();
								}}
								aria-disabled={disabled}
								aria-label="Quitar ítem"
								class="flex h-7 w-7 items-center justify-center rounded-[7px] text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 aria-disabled:opacity-30 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
							>
								<Trash2 class="h-[15px] w-[15px]" />
							</button>
						{/snippet}
						<TriggerTooltip text="Quitar ítem" trigger={removeTrigger} />
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
