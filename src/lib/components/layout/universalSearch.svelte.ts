/**
 * Estado reactivo compartido de la búsqueda universal (CommandSearch escritorio
 * y búsqueda global móvil usan la MISMA lógica: debounce 250 ms sobre el remote
 * `universalSearch`; sin reimplementaciones).
 */
import { universalSearch } from '$lib/remote/search.remote';
import type { SearchResults } from '$lib/remote/search.remote';
import { logger } from '$lib/utils';

export function createUniversalSearch() {
	let query = $state('');
	let results = $state<SearchResults | null>(null);
	let isOpen = $state(false);
	let loading = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout>;

	function handleInput(value: string): void {
		query = value;
		clearTimeout(debounceTimer);
		const q = value.trim();

		if (!q || q.length < 2) {
			results = null;
			isOpen = false;
			return;
		}

		isOpen = true;
		debounceTimer = setTimeout(async () => {
			loading = true;
			try {
				results = await universalSearch({ query: q });
			} catch (e) {
				logger.error('Error en búsqueda global', e);
				results = null;
			} finally {
				loading = false;
			}
		}, 250);
	}

	function clear(): void {
		clearTimeout(debounceTimer);
		query = '';
		results = null;
		isOpen = false;
		loading = false;
	}

	/** Cierra solo los resultados (conserva el texto: blur de escritorio). */
	function closeResults(): void {
		isOpen = false;
	}

	return {
		get query() {
			return query;
		},
		get results() {
			return results;
		},
		get isOpen() {
			return isOpen;
		},
		get loading() {
			return loading;
		},
		get totalResults() {
			return (results?.products.length ?? 0) + (results?.lenses.length ?? 0);
		},
		handleInput,
		clear,
		closeResults
	};
}

export type UniversalSearchState = ReturnType<typeof createUniversalSearch>;
