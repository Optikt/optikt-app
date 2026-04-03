import { describe, it, expect } from 'vitest';
import {
	ManualAdjustmentSchema,
	ListInventoryMovementsSchema,
	ListInventoryLotsSchema
} from './inventory';

describe('ManualAdjustmentSchema', () => {
	it('accepts a valid positive adjustment', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			quantityDelta: 5,
			notes: 'Encontradas en bodega'
		});
		expect(result.success).toBe(true);
	});

	it('accepts a valid negative adjustment', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			quantityDelta: -3,
			notes: 'Merma por daño'
		});
		expect(result.success).toBe(true);
	});

	it('rejects zero delta', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			quantityDelta: 0,
			notes: 'No change'
		});
		expect(result.success).toBe(false);
	});

	it('requires notes', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			quantityDelta: 1,
			notes: ''
		});
		expect(result.success).toBe(false);
	});

	it('requires a valid lot UUID', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: 'not-a-uuid',
			quantityDelta: 1,
			notes: 'Test'
		});
		expect(result.success).toBe(false);
	});
});

describe('ListInventoryMovementsSchema', () => {
	it('accepts empty object (defaults)', () => {
		const result = ListInventoryMovementsSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.perPage).toBe(10);
		}
	});

	it('accepts lotId filter', () => {
		const result = ListInventoryMovementsSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});

	it('accepts productId filter', () => {
		const result = ListInventoryMovementsSchema.safeParse({
			productId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});
});

describe('ListInventoryLotsSchema', () => {
	it('accepts empty object (defaults)', () => {
		const result = ListInventoryLotsSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts isActive filter', () => {
		const result = ListInventoryLotsSchema.safeParse({ isActive: true });
		expect(result.success).toBe(true);
	});

	it('accepts productId filter', () => {
		const result = ListInventoryLotsSchema.safeParse({
			productId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});
});
