import { describe, it, expect } from 'vitest';
import {
	ManualAdjustmentSchema,
	ManualLensAdjustmentSchema,
	ListInventoryMovementsSchema
} from './inventory';
import { InventoryMovementType, AdjustmentReason } from '$lib/shared/enums';

describe('ManualAdjustmentSchema', () => {
	it('accepts a valid positive adjustment', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
			quantity: 5,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			notes: 'Encontradas en bodega durante conteo'
		});
		expect(result.success).toBe(true);
	});

	it('accepts a valid negative adjustment', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_OUT,
			quantity: 3,
			reason: AdjustmentReason.DAMAGE,
			notes: 'Merma por daño en almacén'
		});
		expect(result.success).toBe(true);
	});

	it('rejects quantity of zero', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_OUT,
			quantity: 0,
			reason: AdjustmentReason.DAMAGE,
			notes: 'No change needed'
		});
		expect(result.success).toBe(false);
	});

	it('requires notes of at least 10 characters', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
			quantity: 1,
			reason: AdjustmentReason.OTHER,
			notes: 'short'
		});
		expect(result.success).toBe(false);
	});

	it('requires a valid lot UUID', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: 'not-a-uuid',
			adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
			quantity: 1,
			reason: AdjustmentReason.OTHER,
			notes: 'Test reason with enough chars'
		});
		expect(result.success).toBe(false);
	});

	it('forces ADJUSTMENT_IN for CUSTOMER_RETURN', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_OUT,
			quantity: 1,
			reason: AdjustmentReason.CUSTOMER_RETURN,
			notes: 'Cliente devolvió montura sin reembolso'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.adjustmentType).toBe(InventoryMovementType.ADJUSTMENT_IN);
		}
	});

	it('requires a valid reason enum value', () => {
		const result = ManualAdjustmentSchema.safeParse({
			lotId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
			quantity: 1,
			reason: 'INVALID_REASON',
			notes: 'Some notes that are long enough'
		});
		expect(result.success).toBe(false);
	});
});

describe('ManualLensAdjustmentSchema', () => {
	it('accepts a valid positive lens adjustment', () => {
		const result = ManualLensAdjustmentSchema.safeParse({
			lensCatalogItemId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
			quantity: 2,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			notes: 'Unidades encontradas para cristales STOCK'
		});
		expect(result.success).toBe(true);
	});

	it('forces ADJUSTMENT_IN for CUSTOMER_RETURN', () => {
		const result = ManualLensAdjustmentSchema.safeParse({
			lensCatalogItemId: '00000000-0000-4000-8000-000000000001',
			adjustmentType: InventoryMovementType.ADJUSTMENT_OUT,
			quantity: 1,
			reason: AdjustmentReason.CUSTOMER_RETURN,
			notes: 'Cliente devolvió el par completo al inventario'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.adjustmentType).toBe(InventoryMovementType.ADJUSTMENT_IN);
		}
	});

	it('requires a valid lens UUID', () => {
		const result = ManualLensAdjustmentSchema.safeParse({
			lensCatalogItemId: 'not-a-uuid',
			adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
			quantity: 1,
			reason: AdjustmentReason.OTHER,
			notes: 'Ajuste con nota suficientemente descriptiva'
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

	it('accepts search filter', () => {
		const result = ListInventoryMovementsSchema.safeParse({
			search: 'PO-0001'
		});
		expect(result.success).toBe(true);
	});
});
