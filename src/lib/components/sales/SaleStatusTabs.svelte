<script lang="ts" generics="Status extends string = string">
	// Pestañas facetadas compartidas ventas/presupuestos: el listado puede pasar
	// sus estados y etiquetas (quotes); por defecto usa los de ventas.
	import { ALL_SALE_STATUSES, SALE_STATUS_LABELS } from '$lib/shared/enums';
	import ScrollableRow from '$lib/components/ui/ScrollableRow.svelte';
	import type { SaleStatusCounts } from '$lib/server/db/queries/sales/types';

	interface Props {
		statuses?: readonly Status[];
		labels?: Record<string, string>;
		counts: SaleStatusCounts | Record<string, number>;
		value: Status[];
		onchange: (values: Status[]) => void;
		/** Móvil: una sola fila con scroll horizontal (sin envolver, máscara a la derecha). */
		scroll?: boolean;
		/** Etiqueta del grupo y del botón "Todos" ("Filtrar por estado" / "Todas"). */
		ariaLabel?: string;
		allLabel?: string;
	}

	let {
		statuses = ALL_SALE_STATUSES as unknown as readonly Status[],
		labels = SALE_STATUS_LABELS,
		counts,
		value,
		onchange,
		scroll = false,
		ariaLabel = 'Filtrar por estado',
		allLabel = 'Todas'
	}: Props = $props();

	function countOf(status: string): number {
		return (counts as Record<string, number>)[status] ?? 0;
	}

	const total = $derived(statuses.reduce((sum, status) => sum + countOf(status), 0));

	function toggle(status: Status) {
		onchange(value.includes(status) ? value.filter((s) => s !== status) : [...value, status]);
	}

	const activeKey = $derived([...value].sort().join(','));
</script>

{#snippet pills()}
	<button
		type="button"
		aria-pressed={value.length === 0}
		onclick={() => onchange([])}
		data-active={value.length === 0 ? '' : undefined}
		class="inline-flex shrink-0 items-baseline gap-1.5 rounded-full border px-3 py-2 text-[13px] leading-none font-semibold transition-colors duration-150 {value.length ===
		0
			? 'border-brand-navy bg-brand-navy text-white'
			: 'border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-blue'}"
	>
		{allLabel}
		<b class="text-[12px] font-semibold {value.length === 0 ? 'text-white/70' : 'text-outline'}">
			{total}
		</b>
	</button>

	{#each statuses as status (status)}
		{@const active = value.includes(status)}
		<button
			type="button"
			aria-pressed={active}
			onclick={() => toggle(status)}
			data-active={active ? '' : undefined}
			class="inline-flex shrink-0 items-baseline gap-1.5 rounded-full border px-3 py-2 text-[13px] leading-none font-semibold transition-colors duration-150 {active
				? 'border-brand-navy bg-brand-navy text-white'
				: 'border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-blue'}"
		>
			{labels[status]}
			<b class="text-[12px] font-semibold {active ? 'text-white/70' : 'text-outline'}">
				{countOf(status)}
			</b>
		</button>
	{/each}
{/snippet}

{#if scroll}
	<!-- Fila única desplazable: máscara y re-alineación del activo las maneja ScrollableRow. -->
	<ScrollableRow {activeKey} class="gap-1.5" role="group" {ariaLabel}>
		{@render pills()}
	</ScrollableRow>
{:else}
	<div class="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
		{@render pills()}
	</div>
{/if}
