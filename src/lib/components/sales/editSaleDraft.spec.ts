import { describe, expect, it } from 'vitest';
import { DiscountType } from '$lib/shared/enums';
import { FreeItemCategory, LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
import type { SupplierTreatment } from '$lib/server/db/schema';
import { cacheLensItem } from './catalogCache.svelte';
import {
	applyLensEdit,
	buildLensInputFromDraft,
	buildUpdateSalePayload,
	createEmptyLensDraft,
	createFreeItem,
	createProductItem,
	existingItemToInput,
	getLensEditContext,
	hasChangesForSale,
	itemDetail,
	mapTreatmentsForEdit,
	previewSubtotalForItems,
	seedCatalogCacheForItems,
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

describe('mapTreatmentsForEdit', () => {
	const lens = draft({ id: 'lens-1', itemType: SaleItemType.LENS_PAIR });
	const child = draft({
		id: 't-1',
		itemType: SaleItemType.TREATMENT,
		parentSaleItemId: 'lens-1',
		unitPrice: 20,
		snapshotBaseCost: 10,
		snapshotName: 'AR',
		snapshotIsTaxable: true,
		snapshotTreatmentCategory: 'COAT'
	});
	const other = draft({ id: 'p-1', itemType: SaleItemType.PRODUCT });

	it('maps child treatments with halved prices', () => {
		const result = mapTreatmentsForEdit([lens, child, other], 'lens-1');

		expect(result).toEqual([
			{
				supplierTreatmentId: '',
				name: 'AR',
				price: 5,
				salePrice: 10,
				isTaxable: true,
				category: 'COAT',
				_keep: true
			}
		]);
	});

	it('returns empty without children', () => {
		expect(mapTreatmentsForEdit([lens, other], 'lens-1')).toEqual([]);
	});
});

describe('applyLensEdit', () => {
	const saved = draft({ id: 'lens-9', itemType: SaleItemType.LENS_PAIR });
	const treatment = {
		supplierTreatmentId: 'st-1',
		name: 'AR',
		price: 5,
		salePrice: 10,
		isTaxable: true,
		category: 'COAT'
	};

	it('replaces edited lens with its old children', () => {
		const old = draft({ id: 'lens-9', itemType: SaleItemType.LENS_PAIR });
		const oldChild = draft({
			id: 'old-t',
			itemType: SaleItemType.TREATMENT,
			parentSaleItemId: 'lens-9'
		});
		const kept = draft({ id: 'p-1', itemType: SaleItemType.PRODUCT });

		const result = applyLensEdit([old, oldChild, kept], 'lens-9', saved, [treatment], 'Sup');

		expect(result.map((i) => i.id)).toEqual(['p-1', 'lens-9', undefined]);
		expect(result[2]).toMatchObject({
			itemType: SaleItemType.TREATMENT,
			parentSaleItemId: 'lens-9',
			unitPrice: 20,
			snapshotBaseCost: 10,
			snapshotBrand: 'Sup'
		});
	});

	it('appends new lens keeping removed markers', () => {
		const removed = draft({ id: 'old', _removed: true });

		const result = applyLensEdit([removed], null, saved, [], undefined);

		expect(result.map((i) => i.id)).toEqual(['old', 'lens-9']);
	});
});

describe('createProductItem / createFreeItem', () => {
	it('snapshots product catalog data', () => {
		const result = createProductItem(
			{ name: 'Montura', sku: 'SKU', brand: { name: 'Marca' }, isTaxable: false },
			{
				productId: 'p-1',
				quantity: 2,
				unitPrice: 50,
				discount: 0,
				discountType: DiscountType.FIXED,
				notes: ''
			}
		);

		expect(result).toMatchObject({
			itemType: SaleItemType.PRODUCT,
			snapshotName: 'Montura',
			snapshotSku: 'SKU',
			snapshotBrand: 'Marca',
			snapshotIsTaxable: false,
			_removed: false
		});
		expect(result.notes).toBeUndefined();
	});

	it('trims free item description', () => {
		const result = createFreeItem({
			category: FreeItemCategory.SERVICE,
			description: '  Ajuste  ',
			price: 10,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: ''
		});

		expect(result.freeItemDescription).toBe('Ajuste');
		expect(result.snapshotName).toBe('Ajuste');
		expect(result.freeItemCategory).toBe(FreeItemCategory.SERVICE);
	});
});

describe('buildUpdateSalePayload', () => {
	const sale = {
		id: 'sale-1',
		saleDate: '2026-09-01T10:00:00.000Z',
		notes: null,
		isCashea: false,
		discount: 0,
		discountType: DiscountType.FIXED
	};
	const base = {
		saleDate: '2026-09-01',
		notes: '',
		isCashea: false,
		discount: 0,
		discountType: DiscountType.FIXED,
		reason: 'Corrección',
		removedCount: 0,
		activeItems: [draft({ id: '1' })]
	};

	it('sends only id and reason when nothing changed', () => {
		expect(buildUpdateSalePayload(sale, base)).toEqual({ id: 'sale-1', reason: 'Corrección' });
	});

	it('includes items when discount changes', () => {
		const payload = buildUpdateSalePayload(sale, { ...base, discount: 5 });

		expect(payload.discount).toBe(5);
		expect(payload.items?.length).toBe(1);
	});

	it('maps header diffs', () => {
		const payload = buildUpdateSalePayload(sale, {
			...base,
			notes: 'nota',
			isCashea: true,
			saleDate: '2026-09-02'
		});

		expect(payload.notes).toBe('nota');
		expect(payload.isCashea).toBe(true);
		expect(typeof payload.saleDate).toBe('string');
	});
});

describe('seedCatalogCacheForItems', () => {
	it('resolves without remote when no lens ids', async () => {
		await expect(seedCatalogCacheForItems([])).resolves.toBeUndefined();
		await expect(seedCatalogCacheForItems([{ lensCatalogItemId: null }])).resolves.toBeUndefined();
	});
});

describe('getLensEditContext', () => {
	const treatments = [
		{ id: 't-1', supplierId: 'sup-1', name: 'AR' },
		{ id: 't-2', supplierId: 'other', name: 'Blue' }
	] as SupplierTreatment[];

	it('returns empty context without cached lens', () => {
		const ctx = getLensEditContext('missing-lens', [], treatments);

		expect(ctx).toEqual({
			availableTreatments: [],
			selectableTreatments: [],
			selectedLens: null,
			showAddition: true
		});
	});

	it('filters treatments by lens supplier and excludes current', () => {
		cacheLensItem({
			id: 'lens-ctx-1',
			type: LensType.PROGRESSIVE,
			supplier: { id: 'sup-1', name: 'Sup' }
		} as never);

		const ctx = getLensEditContext(
			'lens-ctx-1',
			[{ supplierTreatmentId: 't-1' } as never],
			treatments
		);

		expect(ctx.selectedLens?.id).toBe('lens-ctx-1');
		expect(ctx.availableTreatments.map((t) => t.id)).toEqual(['t-1']);
		expect(ctx.selectableTreatments).toEqual([]);
		expect(ctx.showAddition).toBe(true);
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
