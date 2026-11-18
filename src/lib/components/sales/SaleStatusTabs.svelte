<script lang="ts">
	// Pestañas facetadas compartidas ventas/presupuestos: el listado pasa sus
	// estados, etiquetas y conteos (el conteo de cada pestaña ignora la propia).
	interface Props {
		statuses: readonly string[];
		labels: Record<string, string>;
		counts: Record<string, number>;
		value: string[];
		onchange: (values: string[]) => void;
		/** Etiqueta del grupo y del botón "Todos" ("Filtrar por estado" / "Todas"). */
		ariaLabel?: string;
		allLabel?: string;
	}

	let {
		statuses,
		labels,
		counts,
		value,
		onchange,
		ariaLabel = 'Filtrar por estado',
		allLabel = 'Todas'
	}: Props = $props();

	const total = $derived(statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0));

	function toggle(status: string) {
		onchange(value.includes(status) ? value.filter((s) => s !== status) : [...value, status]);
	}
</script>

<div class="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
	<button
		type="button"
		aria-pressed={value.length === 0}
		onclick={() => onchange([])}
		class="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-2 text-[13px] leading-none font-semibold transition-colors duration-150 {value.length ===
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
			class="inline-flex items-baseline gap-1.5 rounded-full border px-3 py-2 text-[13px] leading-none font-semibold transition-colors duration-150 {active
				? 'border-brand-navy bg-brand-navy text-white'
				: 'border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-blue'}"
		>
			{labels[status]}
			<b class="text-[12px] font-semibold {active ? 'text-white/70' : 'text-outline'}">
				{counts[status] ?? 0}
			</b>
		</button>
	{/each}
</div>
