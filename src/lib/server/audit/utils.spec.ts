import { describe, it, expect } from 'vitest';
import {
	calculateDiff,
	createChangeRecordForCreate,
	createChangeRecordForDelete,
	hasChanges
} from './utils';

describe('audit/utils', () => {
	describe('calculateDiff', () => {
		it('returns empty object when both entities are identical', () => {
			const entity = { name: 'Test', status: 'active' };
			expect(calculateDiff(entity, entity)).toEqual({});
		});

		it('detects changed string fields', () => {
			const old = { name: 'Old Name', status: 'active' };
			const updated = { name: 'New Name', status: 'active' };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({
				name: { old: 'Old Name', new: 'New Name' }
			});
		});

		it('detects changed numeric fields', () => {
			const old = { price: 100, quantity: 5 };
			const updated = { price: 150, quantity: 5 };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({
				price: { old: 100, new: 150 }
			});
		});

		it('detects null to value changes', () => {
			const old = { name: null as string | null };
			const updated = { name: 'Hello' };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({
				name: { old: null, new: 'Hello' }
			});
		});

		it('detects value to null changes', () => {
			const old = { name: 'Hello' as string | null };
			const updated = { name: null as string | null };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({
				name: { old: 'Hello', new: null }
			});
		});

		it('excludes updatedAt, createdAt, deletedAt, and id fields', () => {
			const old = {
				id: '1',
				name: 'Test',
				createdAt: new Date('2024-01-01'),
				updatedAt: new Date('2024-01-01'),
				deletedAt: null as Date | null
			};
			const updated = {
				id: '1',
				name: 'Updated',
				createdAt: new Date('2024-01-01'),
				updatedAt: new Date('2024-06-01'),
				deletedAt: new Date('2024-06-01')
			};
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({
				name: { old: 'Test', new: 'Updated' }
			});
		});

		it('respects additional excludeFields parameter', () => {
			const old = { name: 'Test', secret: 'old-secret' };
			const updated = { name: 'Updated', secret: 'new-secret' };
			const diff = calculateDiff(old, updated, ['secret']);
			expect(diff).toEqual({
				name: { old: 'Test', new: 'Updated' }
			});
		});

		it('handles Date comparisons correctly', () => {
			const date = new Date('2024-06-15T12:00:00.000Z');
			const old = { birthDate: date };
			const updated = { birthDate: new Date(date.getTime()) };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({});
		});

		it('detects Date changes', () => {
			const old = { birthDate: new Date('2024-01-01T00:00:00.000Z') };
			const updated = { birthDate: new Date('2024-06-15T00:00:00.000Z') };
			const diff = calculateDiff(old, updated);
			expect(Object.keys(diff)).toContain('birthDate');
		});

		it('handles array comparisons', () => {
			const old = { tags: ['a', 'b'] };
			const updated = { tags: ['a', 'b', 'c'] };
			const diff = calculateDiff(old, updated);
			expect(diff).toHaveProperty('tags');
		});

		it('detects no change for identical arrays', () => {
			const old = { tags: ['a', 'b'] };
			const updated = { tags: ['a', 'b'] };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({});
		});

		it('handles nested object comparisons', () => {
			const old = { meta: { key: 'value1' } };
			const updated = { meta: { key: 'value2' } };
			const diff = calculateDiff(old, updated);
			expect(diff).toHaveProperty('meta');
		});

		it('detects new keys in updated entity', () => {
			const old: Record<string, unknown> = { name: 'Test' };
			const updated: Record<string, unknown> = { name: 'Test', email: 'test@example.com' };
			const diff = calculateDiff(old, updated);
			expect(diff).toEqual({
				email: { old: null, new: 'test@example.com' }
			});
		});

		it('normalizes undefined to null', () => {
			const old: Record<string, unknown> = { name: 'Test', email: undefined };
			const updated: Record<string, unknown> = { name: 'Test', email: 'test@example.com' };
			const diff = calculateDiff(old, updated);
			expect(diff.email?.old).toBeNull();
			expect(diff.email?.new).toBe('test@example.com');
		});

		it('handles multiple changes at once', () => {
			const old = { name: 'Old', status: 'active', price: 100 };
			const updated = { name: 'New', status: 'inactive', price: 200 };
			const diff = calculateDiff(old, updated);
			expect(Object.keys(diff)).toHaveLength(3);
		});
	});

	describe('createChangeRecordForCreate', () => {
		it('creates change record with all fields as new', () => {
			const entity = { name: 'Test', status: 'active', price: 100 };
			const record = createChangeRecordForCreate(entity);
			expect(record).toEqual({
				name: { old: null, new: 'Test' },
				status: { old: null, new: 'active' },
				price: { old: null, new: 100 }
			});
		});

		it('excludes system fields (id, createdAt, updatedAt, deletedAt)', () => {
			const entity = {
				id: '1',
				name: 'Test',
				createdAt: new Date(),
				updatedAt: new Date(),
				deletedAt: null as Date | null
			};
			const record = createChangeRecordForCreate(entity);
			expect(record).toEqual({
				name: { old: null, new: 'Test' }
			});
		});

		it('excludes null and undefined values', () => {
			const entity = { name: 'Test', email: null as string | null, phone: undefined };
			const record = createChangeRecordForCreate(entity);
			expect(record).toEqual({
				name: { old: null, new: 'Test' }
			});
		});

		it('respects additional excludeFields', () => {
			const entity = { name: 'Test', secret: 'hidden' };
			const record = createChangeRecordForCreate(entity, ['secret']);
			expect(record).toEqual({
				name: { old: null, new: 'Test' }
			});
		});

		it('normalizes Date values to ISO strings', () => {
			const date = new Date('2024-06-15T12:00:00.000Z');
			const entity = { birthDate: date };
			const record = createChangeRecordForCreate(entity);
			expect(record.birthDate?.new).toBe('2024-06-15T12:00:00.000Z');
		});
	});

	describe('createChangeRecordForDelete', () => {
		it('creates change record with all fields as old', () => {
			const entity = { name: 'Test', status: 'active', price: 100 };
			const record = createChangeRecordForDelete(entity);
			expect(record).toEqual({
				name: { old: 'Test', new: null },
				status: { old: 'active', new: null },
				price: { old: 100, new: null }
			});
		});

		it('excludes system fields', () => {
			const entity = {
				id: '1',
				name: 'Test',
				createdAt: new Date(),
				updatedAt: new Date()
			};
			const record = createChangeRecordForDelete(entity);
			expect(record).toEqual({
				name: { old: 'Test', new: null }
			});
		});

		it('excludes null and undefined values', () => {
			const entity = { name: 'Test', email: null as string | null };
			const record = createChangeRecordForDelete(entity);
			expect(record).toEqual({
				name: { old: 'Test', new: null }
			});
		});

		it('respects additional excludeFields', () => {
			const entity = { name: 'Test', internal: 'data' };
			const record = createChangeRecordForDelete(entity, ['internal']);
			expect(record).toEqual({
				name: { old: 'Test', new: null }
			});
		});
	});

	describe('hasChanges', () => {
		it('returns true when changes exist', () => {
			expect(hasChanges({ name: { old: 'Old', new: 'New' } })).toBe(true);
		});

		it('returns false for empty change record', () => {
			expect(hasChanges({})).toBe(false);
		});

		it('returns true for multiple changes', () => {
			expect(
				hasChanges({
					name: { old: 'A', new: 'B' },
					status: { old: 'active', new: 'inactive' }
				})
			).toBe(true);
		});
	});
});
