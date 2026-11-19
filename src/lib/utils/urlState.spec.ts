import { beforeEach, describe, expect, it, vi } from 'vitest';

// `$app/navigation` es un alias generado por SvelteKit: se mockea para probar
// el contrato del wrapper (replace, misma URL con query nueva) sin runtime.
// La rama con `replaceState` se ejercita en el proyecto browser
// (`urlState.svelte.spec.ts`) — aquí el guard de `window` corta antes.
const replaceStateMock = vi.fn();
vi.mock('$app/navigation', () => ({
	replaceState: (...args: unknown[]) => replaceStateMock(...args)
}));

import { parseBooleanParam, parsePageParam, replaceUrlSearch, setQueryParam } from './urlState';

describe('parsePageParam', () => {
	it('parsea enteros positivos', () => {
		expect(parsePageParam('3')).toBe(3);
	});

	it('usa el fallback con valores inválidos', () => {
		expect(parsePageParam(null)).toBe(1);
		expect(parsePageParam('0')).toBe(1);
		expect(parsePageParam('-2', 4)).toBe(4);
		expect(parsePageParam('abc')).toBe(1);
	});
});

describe('parseBooleanParam', () => {
	it('solo acepta "1" y "true"', () => {
		expect(parseBooleanParam('1')).toBe(true);
		expect(parseBooleanParam('true')).toBe(true);
		expect(parseBooleanParam('0')).toBe(false);
		expect(parseBooleanParam(null)).toBe(false);
	});
});

describe('setQueryParam', () => {
	it('elimina la clave cuando el valor es vacío', () => {
		const params = new URLSearchParams('a=1&b=2');
		setQueryParam(params, 'a', '');
		setQueryParam(params, 'b', null);
		expect(params.toString()).toBe('');
	});

	it('setea el valor como string', () => {
		const params = new URLSearchParams();
		setQueryParam(params, 'page', 7);
		expect(params.get('page')).toBe('7');
	});
});

describe('replaceUrlSearch (guard de servidor)', () => {
	beforeEach(() => {
		replaceStateMock.mockClear();
	});

	it('es no-op sin window (SSR) — no llama replaceState ni lanza', () => {
		if (typeof window !== 'undefined') return; // proyecto browser: cubierto por el spec de navegador
		const url = new URL('https://app.local/sales?q=x');
		expect(() => replaceUrlSearch(url, (params) => setQueryParam(params, 'q', 'y'))).not.toThrow();
		expect(replaceStateMock).not.toHaveBeenCalled();
	});
});
