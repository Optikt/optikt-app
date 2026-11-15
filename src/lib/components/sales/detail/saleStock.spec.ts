import { describe, expect, it } from 'vitest';
import { computeStockNet, filterStockEntries, groupStockMovements } from './saleStock';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';

function movement(overrides: Partial<MovementWithDetails>): MovementWithDetails {
	return {
		id: crypto.randomUUID(),
		movementType: InventoryMovementType.SALE_OUT,
		lotId: crypto.randomUUID(),
		lotNumber: 1,
		itemType: 'PRODUCT',
		productId: crypto.randomUUID(),
		productName: 'Montura X',
		productSku: 'SKU-1',
		lensCatalogItemId: null,
		lensName: null,
		lensType: null,
		itemName: 'Montura X',
		itemCode: 'SKU-1',
		quantityDelta: -1,
		quantityBefore: 10,
		quantityAfter: 9,
		referenceType: MovementReferenceType.SALE,
		referenceId: 'sale-1',
		purchaseOrderNumber: null,
		saleOrderNumber: 1,
		referenceCode: '#0001',
		notes: null,
		unitCostAtAdjustment: null,
		totalCostAtAdjustment: null,
		adjustmentReportCategory: null,
		createdById: 'user-1',
		createdByName: 'Ana',
		createdAt: '2026-11-10T10:00:00.000Z',
		...overrides
	} as MovementWithDetails;
}

describe('groupStockMovements', () => {
	it('groups by reference + actor + minute of createdAt', () => {
		const movements = [
			movement({ id: 'a', createdAt: '2026-11-10T10:00:10.000Z' }),
			movement({ id: 'b', createdAt: '2026-11-10T10:00:50.000Z' }),
			movement({ id: 'c', createdAt: '2026-11-10T10:05:00.000Z' })
		];
		const groups = groupStockMovements(movements);
		expect(groups).toHaveLength(2);
		expect(groups[0].entries.map((e) => e.id)).toEqual(['c']);
		expect(groups[0].kind).toBe('creation');
		expect(groups[0].title).toBe('Creación de la venta');
	});

	it('splits the same actor into separate groups across minutes', () => {
		const movements = [
			movement({ id: 'a', createdAt: '2026-11-10T10:00:00.000Z' }),
			movement({ id: 'b', createdAt: '2026-11-10T10:01:00.000Z' })
		];
		expect(groupStockMovements(movements)).toHaveLength(2);
	});

	it('splits different actors in the same minute', () => {
		const movements = [
			movement({ id: 'a', createdById: 'user-1', createdByName: 'Ana' }),
			movement({ id: 'b', createdById: 'user-2', createdByName: 'Luis' })
		];
		const groups = groupStockMovements(movements);
		expect(groups).toHaveLength(2);
	});

	it('labels edit operations with date and user, most recent first', () => {
		const movements = [
			movement({ id: 'a', createdAt: '2026-11-10T10:00:00.000Z' }),
			movement({
				id: 'b',
				movementType: InventoryMovementType.EDIT_REVERT,
				quantityDelta: 2,
				createdAt: '2026-11-11T15:30:00.000Z',
				notes: 'Edición: cambio de montura'
			}),
			movement({
				id: 'c',
				movementType: InventoryMovementType.SALE_OUT,
				quantityDelta: -1,
				createdAt: '2026-11-11T15:30:20.000Z'
			})
		];
		const groups = groupStockMovements(movements);
		expect(groups).toHaveLength(2);
		expect(groups[0].kind).toBe('edit');
		expect(groups[0].title).toBe('Edición · 2026-11-11 · 15:30 · Ana');
		expect(groups[0].entries).toHaveLength(2);
	});

	it('labels cancellations (legacy CANCEL_REVERT stays cancel)', () => {
		const movements = [
			movement({
				id: 'a',
				movementType: InventoryMovementType.CANCEL_REVERT,
				quantityDelta: 2,
				createdAt: '2026-11-12T09:00:00.000Z'
			})
		];
		const groups = groupStockMovements(movements);
		expect(groups[0].kind).toBe('cancel');
		expect(groups[0].title).toBe('Cancelación');
	});
});

describe('computeStockNet', () => {
	it('nets salidas against both revert types per product', () => {
		const movements = [
			movement({ itemName: 'Montura X', quantityDelta: -2 }),
			movement({
				id: 'r1',
				itemName: 'Montura X',
				movementType: InventoryMovementType.EDIT_REVERT,
				quantityDelta: 2
			}),
			movement({
				id: 'r2',
				itemName: 'Montura X',
				movementType: InventoryMovementType.SALE_OUT,
				quantityDelta: -1,
				createdAt: '2026-11-11T10:00:00.000Z'
			}),
			movement({
				id: 'r3',
				itemName: 'Cristal Y',
				movementType: InventoryMovementType.CANCEL_REVERT,
				quantityDelta: 1,
				createdAt: '2026-11-11T10:00:00.000Z'
			})
		];
		expect(computeStockNet(movements)).toEqual([
			{ name: 'Cristal Y', out: 0, revert: 1, net: -1 },
			{ name: 'Montura X', out: 3, revert: 2, net: 1 }
		]);
	});

	it('returns an empty net for no movements', () => {
		expect(computeStockNet([])).toEqual([]);
	});
});

describe('filterStockEntries', () => {
	it('splits salidas from reversiones', () => {
		const entries = [
			movement({ id: 'a' }),
			movement({
				id: 'b',
				movementType: InventoryMovementType.EDIT_REVERT,
				quantityDelta: 1
			})
		];
		expect(filterStockEntries(entries, 'all')).toHaveLength(2);
		expect(filterStockEntries(entries, 'out').map((e) => e.id)).toEqual(['a']);
		expect(filterStockEntries(entries, 'revert').map((e) => e.id)).toEqual(['b']);
	});
});
