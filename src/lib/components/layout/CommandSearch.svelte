<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import SearchResultsList from '$lib/components/layout/SearchResultsList.svelte';
	import { createUniversalSearch } from '$lib/components/layout/universalSearch.svelte';

	/**
	 * Búsqueda global de escritorio (dropdown bajo el input).
	 * La lógica vive en `universalSearch.svelte.ts` y los resultados en
	 * `SearchResultsList` (compartidos con la búsqueda global móvil).
	 */
	const search = createUniversalSearch();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function handleBlur() {
		// Delay to allow click on results
		setTimeout(() => {
			search.closeResults();
		}, 200);
	}
</script>

<div class="relative w-full max-w-md">
	<!-- Search input -->
	<div class="relative">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
		<input
			type="search"
			value={search.query}
			oninput={(e) => search.handleInput(e.currentTarget.value)}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			onfocus={() => {
				if (search.query.trim().length >= 2) search.handleInput(search.query);
			}}
			placeholder="Buscar productos, lentes... (+3.50 -2.00)"
			class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-10 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
		/>
		{#if search.query}
			<button
				onclick={() => search.clear()}
				class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}
	</div>

	<!-- Dropdown results -->
	{#if search.isOpen}
		<div
			class="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
		>
			<SearchResultsList
				results={search.results}
				loading={search.loading}
				onNavigate={() => search.clear()}
			/>
		</div>
	{/if}
</div>
