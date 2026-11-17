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

describe('buildSaleAuditDiff uncovered branches', () => {
	it('names bare items by type and free items by description', () => {
		const diff = buildSaleAuditDiff(
			[],
			[
				item({ itemType: 'FREE_ITEM', freeItemDescription: 'Ajuste manual' }),
				item({ itemType: 'LENS_PAIR' }),
				item({ itemType: 'TREATMENT' }),
				item({ itemType: 'FREE_ITEM' }),
				item({ itemType: 'PRODUCT' })
			]
		);
		expect(diff.items.map((c) => (c.t === 'add' ? c.name : null))).toEqual([
			'Ajuste manual',
			'Cristales',
			'Tratamiento',
			'Artículo libre',
			'Producto'
		]);
	});

	it('computes percentage line discounts and renders them legibly', () => {
		const added = buildSaleAuditDiff(
			[],
			[
				item({
					snapshotName: 'Montura',
					unitPrice: 100,
					discount: 10,
					discountType: DiscountType.PERCENTAGE
				})
			]
		);
		expect(added.items[0]).toMatchObject({ t: 'add', total: 90 });
		const mod = buildSaleAuditDiff(
			[item({ id: 'a', snapshotName: 'Montura', unitPrice: 100 })],
			[
				item({
					id: 'a',
					snapshotName: 'Montura',
					unitPrice: 100,
					discount: 10,
					discountType: DiscountType.PERCENTAGE
				})
			]
		);
		expect(mod.items).toEqual([
			{
				t: 'mod',
				name: 'Montura',
				fields: [{ key: 'discount', label: 'Descuento de línea', from: null, to: '10 %' }]
			}
		]);
	});

	it('renders eye formulas without axis and nulls empty eyes', () => {
		const mod = buildSaleAuditDiff(
			[
				item({
					id: 'a',
					itemType: 'LENS_PAIR',
					snapshotName: 'Cristal',
					odSphere: 1,
					odCylinder: -0.5,
					odAxis: 180
				})
			],
			[
				item({
					id: 'a',
					itemType: 'LENS_PAIR',
					snapshotName: 'Cristal',
					odSphere: 1,
					odCylinder: -0.5
				})
			]
		);
		const fields = mod.items[0].t === 'mod' ? mod.items[0].fields : [];
		expect(fields).toContainEqual({
			key: 'formulaOD',
			label: 'Fórmula OD',
			from: '+1.00 -0.50 ×180°',
			to: '+1.00 -0.50'
		});
	});

	it('renders mounting measures per eye and pairs', () => {
		const mod = buildSaleAuditDiff(
			[item({ id: 'a', itemType: 'LENS_PAIR', snapshotName: 'Cristal' })],
			[
				item({
					id: 'a',
					itemType: 'LENS_PAIR',
					snapshotName: 'Cristal',
					dp: 62,
					npRight: 31,
					npLeft: 32
				})
			]
		);
		const fields = mod.items[0].t === 'mod' ? mod.items[0].fields : [];
		expect(fields).toContainEqual({
			key: 'mounting',
			label: 'Medidas de montaje',
			from: null,
			to: '62mm'
		});
		const single = buildSaleAuditDiff(
			[item({ id: 'b', itemType: 'LENS_PAIR', snapshotName: 'C2' })],
			[item({ id: 'b', itemType: 'LENS_PAIR', snapshotName: 'C2', npRight: 31 })]
		);
		const singleFields = single.items[0].t === 'mod' ? single.items[0].fields : [];
		expect(singleFields).toContainEqual({
			key: 'mounting',
			label: 'Medidas de montaje',
			from: null,
			to: '31mm'
		});
	});

	it('diffs free-item category and description', () => {
		const mod = buildSaleAuditDiff(
			[
				item({
					id: 'a',
					itemType: 'FREE_ITEM',
					freeItemDescription: 'Ajuste',
					freeItemCategory: 'SERVICE'
				})
			],
			[
				item({
					id: 'a',
					itemType: 'FREE_ITEM',
					freeItemDescription: 'Ajuste fino',
					freeItemCategory: 'REPAIR'
				})
			]
		);
		const fields = mod.items[0].t === 'mod' ? mod.items[0].fields : [];
		expect(fields).toContainEqual({
			key: 'freeItemCategory',
			label: 'Categoría libre',
			from: 'SERVICE',
			to: 'REPAIR'
		});
		expect(fields).toContainEqual({
			key: 'freeItemDescription',
			label: 'Descripción',
			from: 'Ajuste',
			to: 'Ajuste fino'
		});
	});

	it('renders header sale dates, invalid dates as-is, and percent global discounts', () => {
		const diff = buildSaleAuditDiff([], [], {
			beforeHeader: { saleDate: 'not-a-date', discount: 0, discountType: 'FIXED' },
			afterHeader: {
				saleDate: '2026-11-13T20:02:56.000Z',
				discount: 10,
				discountType: DiscountType.PERCENTAGE
			},
			beforeTotals: { subtotal: 100, total: 100 },
			afterTotals: { subtotal: 100, total: 90 }
		});
		const byKey = Object.fromEntries(diff.header.map((r) => [r.key, r]));
		expect(byKey.saleDate).toMatchObject({ label: 'Fecha de venta', from: 'not-a-date' });
		expect(byKey.saleDate.to).toMatch(/2026/);
		expect(byKey.discount).toMatchObject({ label: 'Descuento global', to: '10 %' });
	});

	it('keeps header rows when the cap cuts items first', () => {
		const after: SaleAuditItemLike[] = [];
		for (let i = 0; i < 49; i++) {
			after.push(item({ snapshotName: `Nuevo ${i}`, unitPrice: 1 }));
		}
		const diff = buildSaleAuditDiff([], after, {
			beforeHeader: { notes: null },
			afterHeader: { notes: 'motivo largo' },
			beforeTotals: { subtotal: 0, total: 0 },
			afterTotals: { subtotal: 49, total: 49 }
		});
		// 49 adds + 1 header + 2 totals = 52 → 2 truncated; totals dropped first.
		expect(countSaleAuditChanges(diff)).toBe(50);
		expect(diff.truncated).toBe(2);
		expect(diff.items).toHaveLength(49);
		expect(diff.header.map((r) => r.key)).toEqual(['notes']);
		expect(diff.totals).toEqual([]);
	});

	it('treats id-less before rows as removed', () => {
		const diff = buildSaleAuditDiff([item({ snapshotName: 'Sin id' })], []);
		expect(diff.items).toEqual([{ t: 'del', name: 'Sin id', qty: 1, total: 20, unitPrice: 20 }]);
	});
});

describe('buildSaleAuditDiff remaining branches', () => {
	it('renders fixed line discounts as money', () => {
		const mod = buildSaleAuditDiff(
			[item({ id: 'a', snapshotName: 'Montura', unitPrice: 100, discount: 5 })],
			[item({ id: 'a', snapshotName: 'Montura', unitPrice: 100, discount: 10 })]
		);
		expect(mod.items).toEqual([
			{
				t: 'mod',
				name: 'Montura',
				fields: [
					{ key: 'discount', label: 'Descuento de línea', from: 'USD 5,00', to: 'USD 10,00' }
				]
			}
		]);
	});

	it('renders naso-pupilar pairs without DP', () => {
		const mod = buildSaleAuditDiff(
			[item({ id: 'a', itemType: 'LENS_PAIR', snapshotName: 'Cristal' })],
			[
				item({
					id: 'a',
					itemType: 'LENS_PAIR',
					snapshotName: 'Cristal',
					npRight: 31,
					npLeft: 32
				})
			]
		);
		const fields = mod.items[0].t === 'mod' ? mod.items[0].fields : [];
		expect(fields).toContainEqual({
			key: 'mounting',
			label: 'Medidas de montaje',
			from: null,
			to: '31/32mm'
		});
	});

	it('renders fixed global discounts as money', () => {
		const diff = buildSaleAuditDiff([], [], {
			beforeHeader: { discount: 5, discountType: 'FIXED' },
			afterHeader: { discount: 10, discountType: 'FIXED' },
			beforeTotals: { subtotal: 100, total: 95 },
			afterTotals: { subtotal: 100, total: 90 }
		});
		expect(diff.header).toContainEqual({
			key: 'discount',
			label: 'Descuento global',
			from: 'USD 5,00',
			to: 'USD 10,00'
		});
	});

	it('slices mod fields and drops empty ones under the cap', () => {
		const after: SaleAuditItemLike[] = [];
		for (let i = 0; i < 48; i++) {
			after.push(item({ snapshotName: `Nuevo ${i}`, unitPrice: 1 }));
		}
		after.push(
			item({ id: 'm', snapshotName: 'Viejo', quantity: 1, unitPrice: 10 }),
			item({ id: 'm2', snapshotName: 'Viejo 2', quantity: 3, unitPrice: 10 })
		);
		const before = [
			item({ id: 'm', snapshotName: 'Viejo', quantity: 2, unitPrice: 20 }),
			item({ id: 'm2', snapshotName: 'Viejo 2', quantity: 1, unitPrice: 10 })
		];
		const diff = buildSaleAuditDiff(before, after, {
			beforeTotals: { subtotal: 0, total: 0 },
			afterTotals: { subtotal: 48, total: 48 }
		});
		// 48 adds + mod(2 fields) + mod(sliced to 0, dropped) + 2 totals = 53 → 3 truncated.
		expect(countSaleAuditChanges(diff)).toBe(50);
		expect(diff.truncated).toBe(3);
		const mods = diff.items.filter((c) => c.t === 'mod');
		expect(mods).toHaveLength(1);
		expect(mods[0].t === 'mod' ? mods[0].fields : []).toHaveLength(2);
		expect(diff.totals).toEqual([]);
	});

	it('keeps partial totals when the cap lands mid-totals', () => {
		const after: SaleAuditItemLike[] = [];
		for (let i = 0; i < 48; i++) {
			after.push(item({ snapshotName: `Nuevo ${i}`, unitPrice: 1 }));
		}
		const diff = buildSaleAuditDiff([], after, {
			beforeHeader: { notes: null },
			afterHeader: { notes: 'motivo' },
			beforeTotals: { subtotal: 0, total: 0 },
			afterTotals: { subtotal: 48, total: 48 }
		});
		// 48 adds + 1 header + 2 totals = 51 → 1 truncated, last total dropped.
		expect(countSaleAuditChanges(diff)).toBe(50);
		expect(diff.truncated).toBe(1);
		expect(diff.items).toHaveLength(48);
		expect(diff.header.map((r) => r.key)).toEqual(['notes']);
		expect(diff.totals.map((r) => r.label)).toEqual(['Subtotal']);
	});
});

describe('buildSaleAuditDiff cap at header loop', () => {
	it('drops header rows when items consume the whole budget', () => {
		const after: SaleAuditItemLike[] = [];
		for (let i = 0; i < 50; i++) {
			after.push(item({ snapshotName: `Nuevo ${i}`, unitPrice: 1 }));
		}
		const diff = buildSaleAuditDiff([], after, {
			beforeHeader: { notes: null },
			afterHeader: { notes: 'motivo' },
			beforeTotals: { subtotal: 0, total: 0 },
			afterTotals: { subtotal: 50, total: 50 }
		});
		expect(countSaleAuditChanges(diff)).toBe(50);
		expect(diff.truncated).toBe(3);
		expect(diff.header).toEqual([]);
		expect(diff.totals).toEqual([]);
	});
});
