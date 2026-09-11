import { describe, expect, it } from 'vitest';
import { DiscountType } from '$lib/shared/enums';
import { FreeItemCategory, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
import {
	buildLensInputFromDraft,
	createEmptyLensDraft,
	existingItemToInput,
	hasChangesForSale,
	itemDetail,
	previewSubtotalForItems,
	type EditableItem
} from './editSaleDraft';

function draft(overrides: Partial<EditableItem> = {}): EditableItem {
	return {
		itemType: SaleItemType.PRODUCT,
		quantity: 1,
		unitPrice: 100,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	};
}

describe('createEmptyLensDraft', () => {
	it('creates a blank lens pair draft', () => {
		expect(createEmptyLensDraft()).toEqual({
			itemType: SaleItemType.LENS_PAIR,
			quantity: 1,
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			_removed: false
		});
	});
});

describe('existingItemToInput', () => {
	it('maps db nulls to undefined and keeps free details', () => {
		const result = existingItemToInput({
			id: 7,
			itemType: SaleItemType.FREE_ITEM,
			productId: null,
			lensCatalogItemId: null,
			parentSaleItemId: null,
			supplierTreatmentId: null,
			prescriptionId: null,
			odSphere: null,
			odCylinder: null,
			odAxis: null,
			odAddition: null,
			odAltura: null,
			osSphere: null,
			osCylinder: null,
			osAxis: null,
			osAddition: null,
			osAltura: null,
			quantity: 2,
			unitPrice: 50,
			discount: 5,
			discountType: DiscountType.FIXED,
			snapshotName: 'Gafa',
			snapshotSku: null,
			snapshotBrand: null,
			snapshotBaseCost: null,
			snapshotMountingPrice: null,
			snapshotShippingPrice: null,
			snapshotSalePrice: null,
			snapshotPriceType: null,
			snapshotTreatmentCategory: null,
			snapshotIsTaxable: null,
			shippingCostPending: null,
			freeDetails: {
				category: FreeItemCategory.SERVICE,
				description: 'Ajuste',
				unitCost: 3,
				supplierId: 'sup-1',
				opticalNotes: null
			},
			notes: null
		} as unknown as SaleItemWithDetails);

		expect(result.id).toBe(7);
		expect(result.productId).toBeUndefined();
		expect(result.snapshotSku).toBeUndefined();
		expect(result.freeItemCategory).toBe(FreeItemCategory.SERVICE);
		expect(result.freeItemDescription).toBe('Ajuste');
		expect(result.freeItemUnitCost).toBe(3);
		expect(result._removed).toBe(false);
	});
});

describe('buildLensInputFromDraft', () => {
	it('enriches draft from selected lens', () => {
		const result = buildLensInputFromDraft(draft({ snapshotName: 'Viejo' }), {
			name: 'Novak',
			supplier: { name: 'Sup' },
			pairPurchasePrice: 20,
			mountingPrice: 5,
			shippingPrice: 2,
			salePrice: 60,
			priceType: 'PAIR',
			isTaxable: false
		});

		expect(result.snapshotName).toBe('Novak');
		expect(result.snapshotBrand).toBe('Sup');
		expect(result.snapshotBaseCost).toBe(20);
		expect(result.snapshotShippingPrice).toBe(2);
		expect(result.snapshotSalePrice).toBe(60);
		expect(result.snapshotIsTaxable).toBe(false);
	});

	it('keeps draft values without selection and skips pending shipping', () => {
		const result = buildLensInputFromDraft(
			draft({ snapshotName: 'Viejo', snapshotShippingPrice: 9, shippingCostPending: true }),
			null
		);

		expect(result.snapshotName).toBe('Viejo');
		expect(result.snapshotShippingPrice).toBeUndefined();
		expect(result.snapshotIsTaxable).toBe(true);
	});
});

describe('previewSubtotalForItems', () => {
	it('applies line and global discounts with clamp', () => {
		const items = [
			draft({ unitPrice: 100, quantity: 2, discount: 10, discountType: DiscountType.FIXED }),
			draft({ unitPrice: 50, quantity: 1, discount: 10, discountType: DiscountType.PERCENTAGE })
		];

		const result = previewSubtotalForItems(items, 10, DiscountType.PERCENTAGE);

		expect(result.subtotal).toBe(190 + 45);
		expect(result.globalDiscount).toBeCloseTo(23.5);
		expect(result.total).toBeCloseTo(211.5);
	});

	it('clamps total at zero', () => {
		const result = previewSubtotalForItems([draft({ unitPrice: 10 })], 99, DiscountType.FIXED);

		expect(result.total).toBe(0);
	});
});

describe('itemDetail', () => {
	it('joins sku, brand and free category', () => {
		expect(itemDetail(draft({ snapshotSku: 'SKU', snapshotBrand: 'Marca' }))).toBe(
			'SKU · Marca'
		);
		expect(
			itemDetail(
				draft({ itemType: SaleItemType.FREE_ITEM, freeItemCategory: FreeItemCategory.SERVICE })
			)
		).toBe('SERVICE');
		expect(itemDetail(draft())).toBe('');
	});
});

describe('hasChangesForSale', () => {
	const sale = { saleDate: '2026-09-01T10:00:00', notes: null, discount: 0, discountType: 'FIXED' };
	const clean = [draft({ id: '1' }), draft({ id: '2' })];

	it('detects each change trigger', () => {
		expect(hasChangesForSale(sale, '2026-09-02', '', 0, 'FIXED', clean)).toBe(true);
		expect(hasChangesForSale(sale, '2026-09-01', 'nota', 0, 'FIXED', clean)).toBe(true);
		expect(hasChangesForSale(sale, '2026-09-01', '', 5, 'FIXED', clean)).toBe(true);
		expect(hasChangesForSale(sale, '2026-09-01', '', 0, 'PERCENTAGE', clean)).toBe(true);
		expect(
			hasChangesForSale(sale, '2026-09-01', '', 0, 'FIXED', [draft({ id: '1', _removed: true })])
		).toBe(true);
		expect(hasChangesForSale(sale, '2026-09-01', '', 0, 'FIXED', [draft()])).toBe(true);
		expect(hasChangesForSale(sale, '2026-09-01', '', 0, 'FIXED', clean)).toBe(false);
	});
});
