import { describe, expect, it } from 'vitest';
import { QUOTE_LIST_KEY, QUOTE_LIST_SORT_OPTIONS, QUOTE_LIST_TOGGLES } from './quoteListContext';
import { QUOTE_LIST_SORTS } from './quoteListParams';

describe('quoteListContext', () => {
	it('opciones de orden = los sorts válidos del listado', () => {
		expect(QUOTE_LIST_SORT_OPTIONS.map((o) => o.value)).toEqual([...QUOTE_LIST_SORTS]);
	});

	it('único switch «Mostrar solo»: Cashea; key de contexto propia', () => {
		expect(QUOTE_LIST_TOGGLES).toEqual([{ key: 'cashea', label: 'Cashea' }]);
		expect(typeof QUOTE_LIST_KEY).toBe('symbol');
	});
});
