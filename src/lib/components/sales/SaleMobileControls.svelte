<script lang="ts">
	import { Search, SlidersHorizontal } from '@lucide/svelte';

	/**
	 * Buscador + «Filtros» del listado móvil: fila sticky bajo la barra superior
	 * con sombra al quedar pegada. Mismo debounce de 300 ms (lo maneja el caller)
	 * y semántica server-side que el escritorio.
	 */
	interface Props {
		search: string;
		/** Nº de filtros activos para la burbuja del botón (0 = sin burbuja). */
		activeCount: number;
		filtersOpen: boolean;
		onSearch: (value: string) => void;
		onOpenFilters: () => void;
		/** Generalización quotes: textos e id del buscador. */
		placeholder?: string;
		ariaLabel?: string;
		inputId?: string;
	}

	let {
		search,
		activeCount,
		filtersOpen,
		onSearch,
		onOpenFilters,
		placeholder = 'Buscar cliente, vendedor o #…',
		ariaLabel = 'Buscar ventas',
		inputId = 'sales-search-mobile'
	}: Props = $props();

	let sentinel: HTMLDivElement | undefined = $state();
	let stuck = $state(false);

	// Sombra cuando la fila está pegada arriba (el sentinel deja de verse).
	$effect(() => {
		const target = sentinel;
		if (!target) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				stuck = !(entry?.isIntersecting ?? true);
			},
			{ rootMargin: '-48px 0px 0px 0px' }
		);
		observer.observe(target);
		return () => observer.disconnect();
	});

	const control =
		'h-11 rounded-[var(--ds-radius-md)] border bg-white text-sm font-medium text-on-surface transition-colors focus:border-brand-blue focus:outline-none';
</script>

<div aria-hidden="true" bind:this={sentinel} class="-mt-3 h-0 w-full"></div>

<div
	class="sticky top-0 z-6 -mx-3 bg-surface px-3 py-1.5 transition-shadow duration-200 {stuck
		? 'shadow-[0_8px_12px_-10px_rgba(21,35,70,0.35)]'
		: ''}"
>
	<div class="flex items-center gap-2">
		<div class="relative min-w-0 flex-1">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] -translate-y-1/2 text-outline"
			/>
			<input
				id={inputId}
				type="search"
				value={search}
				oninput={(e) => onSearch(e.currentTarget.value)}
				{placeholder}
				aria-label={ariaLabel}
				inputmode="search"
				enterkeyhint="search"
				class="{control} w-full border-outline-variant pr-3 pl-10"
			/>
		</div>
		<button
			type="button"
			onclick={onOpenFilters}
			aria-haspopup="dialog"
			aria-expanded={filtersOpen}
			class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--ds-radius-md)] border border-outline-variant bg-white px-3.5 text-sm font-semibold text-on-surface transition-colors hover:border-brand-blue {activeCount >
			0
				? 'border-brand-blue text-brand-blue'
				: ''}"
		>
			<SlidersHorizontal class="h-4 w-4" />
			Filtros
			{#if activeCount > 0}
				<span
					class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-navy px-1 text-[10px] font-bold text-white"
				>
					{activeCount}
				</span>
			{/if}
		</button>
	</div>
</div>
