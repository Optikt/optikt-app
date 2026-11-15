import { describe, expect, it } from 'vitest';
import { DiscountType } from '$lib/shared/enums';
import { buildSaleAuditDiff, countSaleAuditChanges, type SaleAuditItemLike } from './saleAuditDiff';

function item(overrides: Partial<SaleAuditItemLike> = {}): SaleAuditItemLike {
	return {
		itemType: 'PRODUCT',
		quantity: 1,
		unitPrice: 20,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	} as SaleAuditItemLike;
}

describe('buildSaleAuditDiff', () => {
	it('returns an empty v1 diff when nothing changed', () => {
		const before = [item({ id: 'a', snapshotName: 'Montura X' })];
		const after = [item({ id: 'a', snapshotName: 'Montura X' })];
		const diff = buildSaleAuditDiff(before, after);
		expect(diff.v).toBe(1);
		expect(diff.items).toEqual([]);
		expect(diff.header).toEqual([]);
		expect(diff.totals).toEqual([]);
		expect(diff.truncated).toBeUndefined();
		expect(countSaleAuditChanges(diff)).toBe(0);
	});

	it('detects added and removed items by id', () => {
		const before = [item({ id: 'a', snapshotName: 'Viejo', quantity: 1, unitPrice: 10 })];
		const after = [item({ id: 'b', snapshotName: 'Nuevo', quantity: 2, unitPrice: 15 })];
		const diff = buildSaleAuditDiff(before, after);
		expect(diff.items).toHaveLength(2);
		expect(diff.items[0]).toMatchObject({ t: 'add', name: 'Nuevo', qty: 2, unitPrice: 15 });
		expect(diff.items[0]).toMatchObject({ total: 30 });
		expect(diff.items[1]).toMatchObject({ t: 'del', name: 'Viejo', qty: 1, total: 10 });
	});

	it('detects a product swap on the same id', () => {
		const before = [item({ id: 'a', productId: 'p1', snapshotName: 'Uno', unitPrice: 10 })];
		const after = [item({ id: 'a', productId: 'p2', snapshotName: 'Dos', unitPrice: 25 })];
		const diff = buildSaleAuditDiff(before, after);
		expect(diff.items).toHaveLength(1);
		expect(diff.items[0]).toEqual({
			t: 'swap',
			from: { name: 'Uno', total: 10 },
			to: { name: 'Dos', total: 25 }
		});
	});

	it('reports mod fields with legible values (price, qty, line discount)', () => {
		const before = [item({ id: 'a', snapshotName: 'X', quantity: 1, unitPrice: 10, discount: 0 })];
		const after = [
			item({
				id: 'a',
				snapshotName: 'X',
				quantity: 2,
				unitPrice: 12,
				discount: 10,
				discountType: DiscountType.PERCENTAGE
			})
		];
		const diff = buildSaleAuditDiff(before, after);
		expect(diff.items).toHaveLength(1);
		const mod = diff.items[0];
		expect(mod.t).toBe('mod');
		if (mod.t !== 'mod') throw new Error('expected mod');
		expect(mod.name).toBe('X');
		expect(mod.fields).toEqual([
			{ key: 'quantity', label: 'Cantidad', from: '1', to: '2' },
			{ key: 'unitPrice', label: 'Precio unitario', from: 'USD 10,00', to: 'USD 12,00' },
			{ key: 'discount', label: 'Descuento de línea', from: null, to: '10 %' }
		]);
	});

	it('formats the prescription formula per eye', () => {
		const before = [item({ id: 'a', itemType: 'LENS_PAIR', snapshotName: 'Cristal' })];
		const after = [
			item({
				id: 'a',
				itemType: 'LENS_PAIR',
				snapshotName: 'Cristal',
				odSphere: -1,
				odCylinder: -1,
				odAxis: 142,
				osSphere: 0.5,
				osAddition: 2,
				dp: 62
			})
		];
		const diff = buildSaleAuditDiff(before, after);
		expect(diff.items).toHaveLength(1);
		const mod = diff.items[0];
		if (mod.t !== 'mod') throw new Error('expected mod');
		expect(mod.fields).toEqual([
			{ key: 'formulaOD', label: 'Fórmula OD', from: null, to: '-1.00 -1.00 ×142°' },
			{ key: 'formulaOS', label: 'Fórmula OI', from: null, to: '+0.50' },
			{ key: 'additionOS', label: 'Adición OI', from: null, to: '+2.00' },
			{ key: 'mounting', label: 'Medidas de montaje', from: null, to: '62mm' }
		]);
	});

	it('treats re-created treatment children without id as add/del', () => {
		const lens = item({ id: 'lens-1', itemType: 'LENS_PAIR', snapshotName: 'Cristal' });
		const before = [
			lens,
			item({
				id: 't-1',
				itemType: 'TREATMENT',
				parentSaleItemId: 'lens-1',
				supplierTreatmentId: 'ar',
				snapshotName: 'Antirreflejo'
			})
		];
		const after = [
			lens,
			item({
				itemType: 'TREATMENT',
				parentSaleItemId: 'lens-1',
				supplierTreatmentId: 'ar',
				snapshotName: 'Antirreflejo'
			})
		];
		const diff = buildSaleAuditDiff(before, after);
		// No id → cannot pair: one del (old child) + one add (re-created child).
		expect(diff.items).toHaveLength(2);
		expect(diff.items.map((c) => c.t).sort()).toEqual(['add', 'del']);
	});

	it('diffs header fields: Cashea, notes and global discount', () => {
		const diff = buildSaleAuditDiff([], [], {
			beforeHeader: { notes: null, isCashea: false, discount: 0, discountType: 'FIXED' },
			afterHeader: {
				notes: 'llamar al cliente',
				isCashea: true,
				discount: 10,
				discountType: 'PERCENTAGE'
			}
		});
		expect(diff.header).toEqual([
			{ key: 'notes', label: 'Notas', from: null, to: 'llamar al cliente' },
			{ key: 'isCashea', label: 'Cashea', from: 'No', to: 'Sí' },
			{ key: 'discount', label: 'Descuento global', from: null, to: '10 %' }
		]);
	});

	it('diffs totals numerically (UI formats at paint time)', () => {
		const diff = buildSaleAuditDiff([], [], {
			beforeTotals: { subtotal: 100, total: 100 },
			afterTotals: { subtotal: 120, total: 108 }
		});
		expect(diff.totals).toEqual([
			{ label: 'Subtotal', from: 100, to: 120 },
			{ label: 'Total', from: 100, to: 108 }
		]);
	});

	it('never exposes internal costs', () => {
		const before = [
			item({
				id: 'a',
				snapshotName: 'Cristal',
				snapshotBaseCost: 10,
				snapshotMountingPrice: 2,
				snapshotShippingPrice: 1,
				snapshotSalePrice: 40,
				shippingCostPending: false,
				freeItemUnitCost: 5
			})
		];
		const after = [
			item({
				id: 'a',
				snapshotName: 'Cristal',
				snapshotBaseCost: 99,
				snapshotMountingPrice: 99,
				snapshotShippingPrice: 99,
				snapshotSalePrice: 99,
				shippingCostPending: true,
				freeItemUnitCost: 99
			})
		];
		const diff = buildSaleAuditDiff(before, after);
		expect(diff.items).toEqual([]);
		expect(countSaleAuditChanges(diff)).toBe(0);
	});

	it('caps at 50 atomic changes and reports the remainder as truncated', () => {
		const before: SaleAuditItemLike[] = [];
		const after: SaleAuditItemLike[] = [];
		for (let i = 0; i < 60; i++) {
			after.push(item({ snapshotName: `Nuevo ${i}`, unitPrice: i + 1 }));
		}
		const diff = buildSaleAuditDiff(before, after, {
			beforeTotals: { subtotal: 0, total: 0 },
			afterTotals: { subtotal: 1, total: 1 }
		});
		expect(countSaleAuditChanges(diff)).toBe(50);
		// 60 adds + 2 total rows = 62 atomic changes → 12 truncated.
		expect(diff.truncated).toBe(12);
		expect(diff.items).toHaveLength(50);
		expect(diff.totals).toEqual([]);
	});
});
