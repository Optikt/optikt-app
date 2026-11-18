<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import SearchResultsList from '$lib/components/layout/SearchResultsList.svelte';
	import { createUniversalSearch } from '$lib/components/layout/universalSearch.svelte';

	/**
	 * Búsqueda global móvil (< lg): reemplaza la barra superior por un campo a
	 * ancho completo con foco automático, panel de ayuda + chips de ejemplo, y
	 * velo navy al 50 % sobre el resto de la pantalla.
	 * La lógica y los resultados son los de la búsqueda global actual
	 * (`universalSearch` + `SearchResultsList`) — solo cambia cómo se abre y se presenta.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const search = createUniversalSearch();

	/** Chips de ejemplo que rellenan el campo (mismo placeholder que escritorio). */
	const EXAMPLES = ['+3.50 -2.00', 'GIO g616', 'Novak', 'True-cleAR'];

	let inputEl: HTMLInputElement | undefined = $state();

	// Foco automático al abrir (el teclado lo abre el navegador con el foco en móvil).
	$effect(() => {
		if (open) {
			inputEl?.focus();
		} else {
			search.clear();
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		}
	}

	function useExample(example: string): void {
		search.handleInput(example);
		inputEl?.focus();
	}
</script>

{#if open}
	<!-- Velo sobre el resto de la pantalla -->
	<div
		class="fixed inset-0 z-50 bg-brand-navy/50"
		role="presentation"
		onclick={onclose}
		aria-hidden="true"
	></div>

	<div class="fixed inset-x-0 top-0 z-51 flex max-h-full flex-col">
		<!-- Barra reemplazada por el campo de búsqueda -->
		<div
			class="flex items-center gap-2 bg-brand-navy p-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]"
		>
			<div class="relative flex-1">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
				/>
				<input
					bind:this={inputEl}
					type="search"
					value={search.query}
					oninput={(e) => search.handleInput(e.currentTarget.value)}
					onkeydown={handleKeydown}
					placeholder="Buscar productos, lentes… (+3.50 -2.00)"
					enterkeyhint="search"
					autocomplete="off"
					aria-label="Búsqueda global"
					class="h-10 w-full rounded-[10px] border border-slate-200 bg-white pr-9 pl-10 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
				/>
				{#if search.query}
					<button
						type="button"
						onclick={() => search.clear()}
						aria-label="Limpiar búsqueda"
						class="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
			<button
				type="button"
				onclick={onclose}
				aria-label="Cerrar búsqueda"
				class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white/80 transition-colors hover:bg-white/10"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Panel: ayuda + ejemplos + resultados -->
		<div
			class="max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-b-2xl bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_8px_24px_rgba(21,35,70,0.16)]"
		>
			<div class="px-4 pt-3.5">
				<p class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
					Búsqueda global
				</p>
				<p class="mt-1 text-[12px] text-on-surface-variant">
					Productos, monturas y lentes por nombre, SKU o graduación.
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each EXAMPLES as example (example)}
						<button
							type="button"
							onclick={() => useExample(example)}
							class="h-10 rounded-full border border-outline-variant bg-white px-3.5 text-[13px] font-semibold text-on-surface transition-colors hover:border-brand-blue"
						>
							{example}
						</button>
					{/each}
				</div>
			</div>

			{#if search.isOpen}
				<div class="mt-2 border-t border-slate-100">
					<SearchResultsList
						results={search.results}
						loading={search.loading}
						onNavigate={onclose}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}
