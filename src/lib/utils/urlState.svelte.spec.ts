import { beforeEach, describe, expect, it, vi } from 'vitest';

// El wrapper real de `$app/navigation` exige el router inicializado (no hay
// app SvelteKit en el runner de componentes): se mockea y se verifica el
// contrato (replace con la URL actual + estado vacío).
const replaceStateMock = vi.fn();
vi.mock('$app/navigation', () => ({
	replaceState: (...args: unknown[]) => replaceStateMock(...args)
}));

import { replaceUrlSearch, setQueryParam } from './urlState';

describe('replaceUrlSearch (navegador)', () => {
	beforeEach(() => {
		replaceStateMock.mockClear();
	});

	it('reemplaza la query de la URL actual (replace, no push)', () => {
		const url = new URL('https://app.local/sales?page=2&q=x');
		replaceUrlSearch(url, (params) => {
			setQueryParam(params, 'q', 'y');
			setQueryParam(params, 'page', null);
		});

		expect(replaceStateMock).toHaveBeenCalledTimes(1);
		const [nextUrl, state] = replaceStateMock.mock.calls[0];
		expect(String(nextUrl)).toBe('https://app.local/sales?q=y');
		expect(state).toEqual({});
	});
});
