<script lang="ts">
	import { ALL_SALE_STATUSES, SALE_STATUS_LABELS, type SaleStatus } from '$lib/shared/enums';
	import ScrollableRow from '$lib/components/ui/ScrollableRow.svelte';
	import type { SaleStatusCounts } from '$lib/server/db/queries/sales/types';

	interface Props {
		counts: SaleStatusCounts;
		value: SaleStatus[];
		onchange: (values: SaleStatus[]) => void;
		/** Móvil: una sola fila con scroll horizontal (sin envolver, máscara a la derecha). */
		scroll?: boolean;
	}

	let { counts, value, onchange, scroll = false }: Props = $props();

	const total = $derived(ALL_SALE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0));

	function toggle(status: SaleStatus) {
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
		Todas
		<b class="text-[12px] font-semibold {value.length === 0 ? 'text-white/70' : 'text-outline'}">
			{total}
		</b>
	</button>

	{#each ALL_SALE_STATUSES as status (status)}
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
			{SALE_STATUS_LABELS[status]}
			<b class="text-[12px] font-semibold {active ? 'text-white/70' : 'text-outline'}">
				{counts[status] ?? 0}
			</b>
		</button>
	{/each}
{/snippet}

{#if scroll}
	<!-- Fila única desplazable: máscara y re-alineación del activo las maneja ScrollableRow. -->
	<ScrollableRow {activeKey} class="gap-1.5" role="group" ariaLabel="Filtrar por estado">
		{@render pills()}
	</ScrollableRow>
{:else}
	<div class="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
		{@render pills()}
	</div>
{/if}
