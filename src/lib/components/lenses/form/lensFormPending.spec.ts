import { describe, expect, it } from 'vitest';
import {
	createPendingEntity,
	getPendingName,
	handleCreatePending,
	isPendingId,
	type PendingEntity
} from './lensFormPending';

describe('createPendingEntity', () => {
	it('trims name and prefixes id', () => {
		const entity = createPendingEntity('  Novak  ');

		expect(entity.name).toBe('Novak');
		expect(entity.pendingId.startsWith('pending_')).toBe(true);
	});

	it('accepts custom prefix', () => {
		expect(createPendingEntity('X', 'supplier').pendingId.startsWith('supplier_')).toBe(true);
	});
});

describe('handleCreatePending', () => {
	it('appends entity and returns selectable option', () => {
		const { updatedList, option } = handleCreatePending([], 'Nuevo');

		expect(updatedList.length).toBe(1);
		expect(option).toEqual({ id: updatedList[0].pendingId, name: 'Nuevo', isPending: true });
	});

	it('keeps existing entries', () => {
		const existing: PendingEntity[] = [{ pendingId: 'pending_a', name: 'A' }];
		const { updatedList } = handleCreatePending(existing, 'B');

		expect(updatedList.length).toBe(2);
		expect(updatedList[0]).toEqual(existing[0]);
	});
});

describe('getPendingName', () => {
	const suppliers: PendingEntity[] = [{ pendingId: 'pending_s', name: 'Sup' }];
	const materials: PendingEntity[] = [{ pendingId: 'pending_m', name: 'Mat' }];
	const technologies: PendingEntity[] = [{ pendingId: 'pending_t', name: 'Tech' }];

	it('searches suppliers, materials and technologies in order', () => {
		expect(getPendingName('pending_s', suppliers, materials, technologies)).toBe('Sup');
		expect(getPendingName('pending_m', suppliers, materials, technologies)).toBe('Mat');
		expect(getPendingName('pending_t', suppliers, materials, technologies)).toBe('Tech');
		expect(getPendingName('missing', suppliers, materials, technologies)).toBeNull();
	});
});

describe('isPendingId', () => {
	it('detects pending prefix', () => {
		expect(isPendingId('pending_123')).toBe(true);
		expect(isPendingId('supplier_123')).toBe(false);
		expect(isPendingId('')).toBe(false);
	});
});
