<script lang="ts">
	import { ALL_SALE_STATUSES, SALE_STATUS_LABELS, type SaleStatus } from '$lib/shared/enums';
	import type { SaleStatusCounts } from '$lib/server/db/queries/sales/types';

	interface Props {
		counts: SaleStatusCounts;
		value: SaleStatus[];
		onchange: (values: SaleStatus[]) => void;
	}

	let { counts, value, onchange }: Props = $props();

	const total = $derived(ALL_SALE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0));

	function toggle(status: SaleStatus) {
		onchange(value.includes(status) ? value.filter((s) => s !== status) : [...value, status]);
	}
</script>

<div class="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
	<button
		type="button"
		aria-pressed={value.length === 0}
		onclick={() => onchange([])}
		class="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-2 text-[13px] leading-none font-semibold transition-colors duration-150 {value.length ===
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
			class="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-2 text-[13px] leading-none font-semibold transition-colors duration-150 {active
				? 'border-brand-navy bg-brand-navy text-white'
				: 'border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-blue'}"
		>
			{SALE_STATUS_LABELS[status]}
			<b class="text-[12px] font-semibold {active ? 'text-white/70' : 'text-outline'}">
				{counts[status] ?? 0}
			</b>
		</button>
	{/each}
</div>
