import { beforeEach, describe, expect, it } from 'vitest';
import {
	ApplyAdjustmentsBatchSchema,
	ApplyCountLineAdjustmentSchema,
	CancelInventoryCountSessionSchema,
	ConfirmZeroStockSchema,
	CreateCountSessionSchema,
	PreviewCountScopeSchema,
	RecountCountLineSchema,
	ReasonSchema,
	SetSessionResponsiblesSchema,
	UpsertCountLineSchema
} from './inventoryCount';

describe('CreateCountSessionSchema', () => {
	beforeEach(() => {});

	it('acepta alcance ALL sin valores y con quick', () => {
		const result = CreateCountSessionSchema.safeParse({
			dim: 'ALL',
			values: [],
			quick: 'OLDEST',
			n: 50,
			responsibles: []
		});
		expect(result.success).toBe(true);
	});

	it('rechaza quick combinado con valores de dimensión', () => {
		const result = CreateCountSessionSchema.safeParse({
			dim: 'ALL',
			values: ['x'],
			quick: 'OLDEST',
			responsibles: []
		});
		expect(result.success).toBe(false);
	});

	it('exige al menos un valor para marca/proveedor/tipo', () => {
		const result = CreateCountSessionSchema.safeParse({ dim: 'BRAND', values: [] });
		expect(result.success).toBe(false);
	});

	it('rechaza valores con alcance ALL sin quick', () => {
		const result = CreateCountSessionSchema.safeParse({ dim: 'ALL', values: ['x'] });
		expect(result.success).toBe(false);
	});

	it('acepta marcas múltiples y notas cortas con responsables', () => {
		const result = CreateCountSessionSchema.safeParse({
			dim: 'BRAND',
			values: ['b1', 'b2'],
			responsibles: [
				{ userId: '3f5af9db-7b19-4118-8105-8ec15e34a4b1', displayName: 'Ana', isExternal: false }
			]
		});
		expect(result.success).toBe(true);
	});
});

describe('PreviewCountScopeSchema (sin .pick con refinements)', () => {
	it('acepta la forma del panel y rechaza extras malos', () => {
		expect(PreviewCountScopeSchema.safeParse({ dim: 'ALL', values: [] }).success).toBe(true);
		expect(PreviewCountScopeSchema.safeParse({ dim: 'other' }).success).toBe(false);
	});
});

describe('Upsert / Recount de líneas', () => {
	it('rechaza conteo negativo', () => {
		expect(UpsertCountLineSchema.safeParse({ lineId: 1, countedStock: -1 }).success).toBe(false);
	});

	it('rechaza nota mayor a 240', () => {
		expect(
			UpsertCountLineSchema.safeParse({ lineId: 1, countedStock: 1, notes: 'a'.repeat(241) })
				.success
		).toBe(false);
	});

	it('rechaza recuento inválido', () => {
		expect(RecountCountLineSchema.safeParse({ lineId: 1, recountedStock: -4 }).success).toBe(false);
	});
});

describe('Motivos de ajuste', () => {
	it('ReasonSchema exige motivo conocido', () => {
		expect(ReasonSchema.safeParse({ reason: 'DAMAGE' }).success).toBe(true);
		expect(ReasonSchema.safeParse({ reason: 'LOCURA' }).success).toBe(false);
	});

	it('ApplyCountLineAdjustmentSchema exige lineId', () => {
		expect(ApplyCountLineAdjustmentSchema.safeParse({ lineId: 0, reason: 'DAMAGE' }).success).toBe(
			false
		);
	});

	it('ApplyAdjustmentsBatchSchema exige session y motivo', () => {
		expect(ApplyAdjustmentsBatchSchema.safeParse({ sessionId: 1 }).success).toBe(false);
	});
});

describe('Cancelación y confirmación de stock 0', () => {
	it('CancelInventoryCountSessionSchema exige motivo (5-500)', () => {
		expect(CancelInventoryCountSessionSchema.safeParse({ id: 3, reason: 'va' }).success).toBe(
			false
		);
		expect(
			CancelInventoryCountSessionSchema.safeParse({ id: 3, reason: 'Motivo completo' }).success
		).toBe(true);
		expect(
			CancelInventoryCountSessionSchema.safeParse({ id: 3, reason: 'x'.repeat(501) }).success
		).toBe(false);
	});

	it('ConfirmZeroStockSchema exige sessionId entero', () => {
		expect(ConfirmZeroStockSchema.safeParse({ sessionId: 0 }).success).toBe(false);
	});
});

describe('SetSessionResponsiblesSchema', () => {
	it('máx 20 entradas y entradas bien formadas', () => {
		const entries = Array.from({ length: 21 }, () => ({
			displayName: 'Responsable',
			isExternal: true
		}));
		expect(SetSessionResponsiblesSchema.safeParse({ sessionId: 1, entries }).success).toBe(false);
	});
});
