import { describe, expect, it } from 'vitest';
import { getAppMainScroll } from './scroll';

// Proyecto browser: cubre la rama con `<main>` del layout (el spec server
// cubre el guard de SSR).
describe('getAppMainScroll (navegador)', () => {
	it('devuelve el `<main>` del layout', () => {
		const main = document.createElement('main');
		document.body.appendChild(main);
		try {
			expect(getAppMainScroll()).toBe(main);
		} finally {
			main.remove();
		}
	});
});
