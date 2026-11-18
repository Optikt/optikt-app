import { describe, expect, it } from 'vitest';
import { getAppMainScroll } from './scroll';

// Proyecto server (node): sin `document` — la función debe ser nula sin romper.
describe('getAppMainScroll (server)', () => {
	it('es nula sin documento (SSR)', () => {
		expect(typeof document === 'undefined').toBe(true);
		expect(getAppMainScroll()).toBeNull();
	});
});
