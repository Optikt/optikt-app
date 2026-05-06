import { describe, expect, it } from 'vitest';

import {
	formatRelationUnlinkBlockedMessage,
	getAvailableRelationOptions
} from './brandSupplierRelations';

describe('brand supplier relation helpers', () => {
	it('filters out already related options', () => {
		const options = [
			{ id: 'brand-1', name: 'Ray-Ban' },
			{ id: 'brand-2', name: 'Oakley' },
			{ id: 'brand-3', name: 'Maui Jim' }
		];

		expect(getAvailableRelationOptions(options, [{ id: 'brand-2', name: 'Oakley' }])).toEqual([
			{ id: 'brand-1', name: 'Ray-Ban' },
			{ id: 'brand-3', name: 'Maui Jim' }
		]);
	});

	it('formats singular blocked unlink message', () => {
		expect(formatRelationUnlinkBlockedMessage(1)).toBe(
			'No se puede quitar esta relacion: hay 1 producto registrado con esta marca y este proveedor. Corrige esos productos primero.'
		);
	});

	it('formats plural blocked unlink message', () => {
		expect(formatRelationUnlinkBlockedMessage(3)).toBe(
			'No se puede quitar esta relacion: hay 3 productos registrados con esta marca y este proveedor. Corrige esos productos primero.'
		);
	});
});
