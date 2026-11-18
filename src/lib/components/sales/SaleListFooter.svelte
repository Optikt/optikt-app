<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import { SALE_LIST_PAGE_SIZES } from './listParams';
	import type { SalesSelectionSummary } from '$lib/server/db/queries/sales/types';

	interface Props {
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		selection: SalesSelectionSummary;
		/** El selector "por página" solo aparece en la vista Lista (spec §6.4). */
		showPerPage: boolean;
		/** Móvil: resumen de selección plegable + paginación ‹ › sin números. */
		narrow?: boolean;
		onPageChange: (page: number) => void;
		onPerPageChange: (perPage: number) => void;
	}

	let {
		page,
		perPage,
		total,
		totalPages,
		selection,
		showPerPage,
		narrow = false,
		onPageChange,
		onPerPageChange
	}: Props = $props();

	const from = $derived((page - 1) * perPage + 1);
	const to = $derived(Math.min(page * perPage, total));

	const visiblePages = $derived.by(() => {
		if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
		if (page <= 3) return [1, 2, 3, 4, 5];
		if (page >= totalPages - 2) {
			return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
		}
		return [page - 2, page - 1, page, page + 1, page + 2];
	});

	const selectClass =
		'h-7 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-1.5 text-[12px] font-semibold text-on-surface focus:border-brand-blue focus:outline-none';
	const pageButtonClass =
		'min-w-[30px] rounded-[var(--ds-radius-md)] px-2 py-1 text-[13px] font-semibold transition-colors duration-150 disabled:cursor-default disabled:opacity-35';

	// ── Móvil: resumen plegable ─────────────────────────────────────────────
	let selectionOpen = $state(false);
	const cobrado = $derived(selection.totalUsd - selection.balanceUsd);
</script>

{#if narrow}
	<!-- Resumen de la selección plegable: «Selección · N ventas · saldo USD x ▾» -->
	<div class="rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)]">
		<button
			type="button"
			onclick={() => (selectionOpen = !selectionOpen)}
			aria-expanded={selectionOpen}
			class="flex min-h-11 w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] font-semibold text-on-surface"
		>
			<span class="flex-1">
				Selección · {total}
				{total === 1 ? 'venta' : 'ventas'} · saldo
				{formatPrice(selection.balanceUsd)}
			</span>
			{#if selectionOpen}
				<ChevronUp class="h-4 w-4 shrink-0 text-on-surface-variant" />
			{:else}
				<ChevronDown class="h-4 w-4 shrink-0 text-on-surface-variant" />
			{/if}
		</button>
		{#if selectionOpen}
			<div class="grid grid-cols-3 gap-2 px-3.5 pt-2 pb-3">
				<div class="rounded-[var(--ds-radius-md)] bg-surface-container-low p-2.5">
					<p class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
						Total
					</p>
					<p class="font-heading mt-0.5 text-[14px] font-bold text-brand-navy tabular-nums">
						{formatPrice(selection.totalUsd)}
					</p>
				</div>
				<div class="rounded-[var(--ds-radius-md)] bg-surface-container-low p-2.5">
					<p class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
						Cobrado
					</p>
					<p class="font-heading mt-0.5 text-[14px] font-bold text-brand-navy tabular-nums">
						{formatPrice(cobrado)}
					</p>
				</div>
				<div class="rounded-[var(--ds-radius-md)] bg-surface-container-low p-2.5">
					<p class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
						Saldo
					</p>
					<p class="font-heading mt-0.5 text-[14px] font-bold text-warning tabular-nums">
						{formatPrice(selection.balanceUsd)}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Paginación móvil: ‹ Anterior · Página X de Y · Siguiente › -->
	<nav class="flex items-center gap-2" aria-label="Paginación">
		<button
			type="button"
			class="flex h-[46px] flex-1 items-center justify-center gap-1 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white text-[13px] font-bold transition-colors hover:bg-surface-container-low disabled:opacity-40"
			disabled={page <= 1}
			onclick={() => onPageChange(page - 1)}
		>
			‹ Anterior
		</button>
		<span class="text-center text-[13px] font-semibold whitespace-nowrap text-on-surface">
			Página {page} de {totalPages}
		</span>
		<button
			type="button"
			class="flex h-[46px] flex-1 items-center justify-center gap-1 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white text-[13px] font-bold transition-colors hover:bg-surface-container-low disabled:opacity-40"
			disabled={page >= totalPages}
			onclick={() => onPageChange(page + 1)}
		>
			Siguiente ›
		</button>
	</nav>
{:else}
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 px-4 py-2.5"
	>
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-on-surface-variant">
			<p>
				Mostrando
				<b class="font-semibold text-on-surface tabular-nums">{from}–{to}</b>
				de
				<b class="font-semibold text-on-surface tabular-nums">{total}</b>
				ventas
			</p>

			<TriggerTooltip text="Suma de las {total} ventas que cumplen los filtros (sin canceladas)">
				{#snippet trigger({ props })}
					<span {...props} class="cursor-default">
						Selección: total <b class="font-semibold text-on-surface tabular-nums">
							{formatPrice(selection.totalUsd)}
						</b>
						· saldo
						<b class="font-semibold text-on-surface tabular-nums">
							{formatPrice(selection.balanceUsd)}
						</b>
					</span>
				{/snippet}
			</TriggerTooltip>

			{#if showPerPage}
				<label class="flex items-center gap-1.5">
					Por página
					<select
						class={selectClass}
						value={perPage}
						onchange={(e) => onPerPageChange(Number(e.currentTarget.value))}
					>
						{#each SALE_LIST_PAGE_SIZES as size (size)}
							<option value={size}>{size}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<nav class="flex items-center gap-1" aria-label="Paginación">
			<button
				type="button"
				class="{pageButtonClass} hover:bg-surface-container-high"
				disabled={page <= 1}
				aria-label="Página anterior"
				onclick={() => onPageChange(page - 1)}
			>
				‹
			</button>
			{#each visiblePages as p (p)}
				<button
					type="button"
					class="{pageButtonClass} {p === page
						? 'bg-brand-blue text-white'
						: 'text-on-surface-variant hover:bg-surface-container-high'}"
					aria-current={p === page ? 'page' : undefined}
					aria-label="Página {p}"
					onclick={() => onPageChange(p)}
				>
					{p}
				</button>
			{/each}
			<button
				type="button"
				class="{pageButtonClass} hover:bg-surface-container-high"
				disabled={page >= totalPages}
				aria-label="Página siguiente"
				onclick={() => onPageChange(page + 1)}
			>
				›
			</button>
		</nav>
	</div>
{/if}
