import { describe, expect, it } from 'vitest';
import {
	CancelInventoryCountSessionSchema,
	CreateInventoryCountSessionSchema,
	GetSessionLinesSchema,
	GetSessionsSchema,
	SetInventoryCountLineAdjustmentStatusSchema,
	SessionIdSchema,
	UpsertInventoryCountLineSchema,
	canCloseInventoryCountSession,
	formatInventoryCountScope,
	getInventoryCountStatusLabel
} from './inventoryCount';

describe('CreateInventoryCountSessionSchema', () => {
	it('accepts a full inventory session', () => {
		const result = CreateInventoryCountSessionSchema.safeParse({
			scopeType: 'ALL',
			notes: 'Conteo mensual general de tienda'
		});

		expect(result.success).toBe(true);
	});

	it('accepts product-only sessions without a category to include all products', () => {
		const result = CreateInventoryCountSessionSchema.safeParse({
			scopeType: 'PRODUCT_CATEGORY',
			notes: 'Solo monturas'
		});

		expect(result.success).toBe(true);
	});

	it('accepts product-only sessions for a specific category', () => {
		const result = CreateInventoryCountSessionSchema.safeParse({
			scopeType: 'PRODUCT_CATEGORY',
			scopeValue: 'FRAME'
		});

		expect(result.success).toBe(true);
	});

	it('rejects scopeValue when scopeType is not PRODUCT_CATEGORY', () => {
		const result = CreateInventoryCountSessionSchema.safeParse({
			scopeType: 'LENS',
			scopeValue: 'FRAME'
		});

		expect(result.success).toBe(false);
	});
});

describe('SessionIdSchema', () => {
	it('coerces a numeric string', () => {
		const result = SessionIdSchema.safeParse({ id: '12' });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe(12);
		}
	});
});

describe('GetSessionsSchema', () => {
	it('defaults the limit to 20', () => {
		const result = GetSessionsSchema.safeParse({});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.limit).toBe(20);
		}
	});

	it('accepts scope and exact-day filters', () => {
		const result = GetSessionsSchema.safeParse({
			limit: 50,
			scopeType: 'LENS',
			openedOn: '2026-05-03'
		});

		expect(result.success).toBe(true);
	});
});

describe('GetSessionLinesSchema', () => {
	it('accepts a valid filter', () => {
		const result = GetSessionLinesSchema.safeParse({ sessionId: 4, filter: 'WITH_DIFF' });

		expect(result.success).toBe(true);
	});
});

describe('UpsertInventoryCountLineSchema', () => {
	it('accepts zero as counted stock', () => {
		const result = UpsertInventoryCountLineSchema.safeParse({
			sessionId: 3,
			itemId: '00000000-0000-4000-8000-000000000010',
			itemType: 'PRODUCT',
			countedStock: 0,
			notes: 'Sin unidades en anaquel'
		});

		expect(result.success).toBe(true);
	});

	it('rejects negative counted stock', () => {
		const result = UpsertInventoryCountLineSchema.safeParse({
			sessionId: 3,
			itemId: '00000000-0000-4000-8000-000000000010',
			itemType: 'LENS',
			countedStock: -1
		});

		expect(result.success).toBe(false);
	});
});

describe('CancelInventoryCountSessionSchema', () => {
	it('requires a reason', () => {
		const result = CancelInventoryCountSessionSchema.safeParse({
			id: 2,
			reason: '  '
		});

		expect(result.success).toBe(false);
	});
});

describe('SetInventoryCountLineAdjustmentStatusSchema', () => {
	it('accepts a valid adjustment tracking payload', () => {
		const result = SetInventoryCountLineAdjustmentStatusSchema.safeParse({
			lineId: 7,
			adjustmentCompleted: true
		});

		expect(result.success).toBe(true);
	});
});

describe('inventory count helpers', () => {
	it('formats product-category scopes', () => {
		expect(formatInventoryCountScope('PRODUCT_CATEGORY', 'FRAME')).toBe('Solo productos - FRAME');
	});

	it('formats status labels with fallback', () => {
		expect(getInventoryCountStatusLabel('APPLIED')).toBe('Aplicada');
		expect(getInventoryCountStatusLabel('CUSTOM')).toBe('CUSTOM');
	});

	it('only allows closing when every line was explicitly counted', () => {
		expect(canCloseInventoryCountSession(4, 4)).toBe(true);
		expect(canCloseInventoryCountSession(4, 3)).toBe(false);
		expect(canCloseInventoryCountSession(0, 0)).toBe(false);
	});
});
