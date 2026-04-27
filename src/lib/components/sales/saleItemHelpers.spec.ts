import { describe, expect, it } from 'vitest';

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { DiscountType } from '$lib/shared/enums';
import {
	LensCatalogSource,
	LensInventoryMode,
	LensPriceType,
	LensType
} from '$lib/shared/enums/lensTypes';

import {
	buildStep2PrescriptionConfirmation,
	calculateSaleSummarySubtotal,
	computeItemDiscount,
	getAvailableProductStock,
	getItemDiscountMax,
	getLensRangeWarningsForItem,
	getLensTypeSuggestionState,
	getRequestedProductQuantity,
	isItemDiscountValid,
	itemLineTotal,
	step2ItemLineTotal,
	type Step2PrescriptionConfirmation
} from './saleItemHelpers';
import { createEmptyLensPair, type SaleItemRow, type SelectedTreatment } from './newSaleTypes';

function makeLensItem(
	overrides: Partial<LensCatalogItemWithRelations> = {}
): LensCatalogItemWithRelations {
	return {
		id: 'lens-1',
		source: LensCatalogSource.LAB,
		supplierId: 'supplier-1',
		name: 'Alpha Lens',
		type: LensType.MONOFOCAL,
		technology: null,
		materialId: 'material-1',
		hasAr: false,
		hasBluecut: false,
		isPhotochromic: false,
		priceType: LensPriceType.PAIR,
		basePrice: 10,
		pairPurchasePrice: 20,
		salePrice: 30,
		mountingPrice: 2,
		shippingPrice: 1,
		isTaxable: false,
		inventoryMode: LensInventoryMode.ON_DEMAND,
		stock: null,
		notes: null,
		isActive: true,
		deletedAt: null,
		createdAt: '2026-04-20T00:00:00.000Z',
		updatedAt: '2026-04-20T00:00:00.000Z',
		material: null,
		supplier: null,
		ranges: [],
		...overrides
	};
}

function makeConfirmationLensRow(id: string = 'row-1'): SaleItemRow {
	const lensPair = createEmptyLensPair();
	lensPair.catalogItemId = 'lens-1';

	return {
		id,
		kind: 'lens',
		productId: '',
		quantity: 1,
		lensPair,
		treatments: [],
		freeItem: null,
		unitPrice: 30,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		costOverrides: null,
		shippingCostPending: false
	};
}

function makeConfirmation(
	overrides: Partial<Parameters<typeof buildStep2PrescriptionConfirmation>[2]> = {},
	items: SaleItemRow[] = [makeConfirmationLensRow()],
	lensItems: LensCatalogItemWithRelations[] = [makeLensItem()]
): Step2PrescriptionConfirmation {
	return buildStep2PrescriptionConfirmation(items, lensItems, {
		odSphere: '1.00',
		odCylinder: '-0.50',
		odAxis: '90',
		odAddition: '',
		oiSphere: '1.25',
		oiCylinder: '-0.25',
		oiAxis: '85',
		oiAddition: '',
		lensType: LensType.MONOFOCAL,
		...overrides
	});
}

describe('buildStep2PrescriptionConfirmation', () => {
	it('marks matching lens type when prescription matches catalog', () => {
		const confirmation = makeConfirmation();

		expect(confirmation.hasLensItems).toBe(true);
		expect(confirmation.items[0]?.typeMatches).toBe(true);
	});

	it('marks lens type mismatch when prescription and catalog differ', () => {
		const confirmation = makeConfirmation({ lensType: LensType.PROGRESSIVE });

		expect(confirmation.items[0]?.typeMatches).toBe(false);
		expect(confirmation.items[0]?.catalogLensType).toBe(LensType.MONOFOCAL);
		expect(confirmation.items[0]?.prescriptionLensType).toBe(LensType.PROGRESSIVE);
	});

	it('marks enabled eyes as in range when prescription fits the catalog', () => {
		const lens = makeLensItem({
			ranges: [
				{
					id: 'range-1',
					lensCatalogItemId: 'lens-1',
					sphereMin: -2,
					sphereMax: 2,
					cylinderMin: -2,
					cylinderMax: 0,
					additionMin: null,
					additionMax: null,
					createdAt: '2026-04-20T00:00:00.000Z',
					updatedAt: '2026-04-20T00:00:00.000Z'
				}
			]
		});

		const confirmation = makeConfirmation({}, [makeConfirmationLensRow()], [lens]);

		expect(confirmation.items[0]?.eyes.map((eye) => eye.status)).toEqual(['in-range', 'in-range']);
		expect(getLensRangeWarningsForItem('row-1', confirmation)).toHaveLength(0);
	});

	it('marks eyes outside of range when no optical range matches', () => {
		const lens = makeLensItem({
			ranges: [
				{
					id: 'range-1',
					lensCatalogItemId: 'lens-1',
					sphereMin: -1,
					sphereMax: 1,
					cylinderMin: -1,
					cylinderMax: 0,
					additionMin: null,
					additionMax: null,
					createdAt: '2026-04-20T00:00:00.000Z',
					updatedAt: '2026-04-20T00:00:00.000Z'
				}
			]
		});

		const confirmation = makeConfirmation(
			{ odSphere: '3.50', oiSphere: '0.75' },
			[makeConfirmationLensRow()],
			[lens]
		);

		expect(confirmation.items[0]?.eyes[0]?.status).toBe('out-of-range');
		expect(getLensRangeWarningsForItem('row-1', confirmation)).toHaveLength(1);
	});

	it('marks eyes for lab review when the lens has no defined ranges', () => {
		const confirmation = makeConfirmation();

		expect(confirmation.items[0]?.hasRanges).toBe(false);
		expect(confirmation.items[0]?.eyes.map((eye) => eye.status)).toEqual([
			'lab-review',
			'lab-review'
		]);
	});

	it('flags multiple lenses in the same operation', () => {
		const secondLens = makeLensItem({ id: 'lens-2', name: 'Beta Lens' });
		const firstRow = makeConfirmationLensRow('row-1');
		const secondRow = makeConfirmationLensRow('row-2');
		secondRow.lensPair!.catalogItemId = 'lens-2';

		const confirmation = makeConfirmation({}, [firstRow, secondRow], [makeLensItem(), secondLens]);

		expect(confirmation.lensCount).toBe(2);
		expect(confirmation.hasMultipleLenses).toBe(true);
	});

	it('returns a neutral state when there are no lens items', () => {
		const confirmation = buildStep2PrescriptionConfirmation(
			[
				{
					id: 'product-1',
					kind: 'product',
					productId: 'product-1',
					quantity: 1,
					lensPair: null,
					treatments: [],
					freeItem: null,
					unitPrice: 10,
					discount: 0,
					discountType: DiscountType.FIXED,
					notes: '',
					costOverrides: null,
					shippingCostPending: false
				}
			],
			[makeLensItem()],
			{
				odSphere: '',
				odCylinder: '',
				odAxis: '',
				odAddition: '',
				oiSphere: '',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.MONOFOCAL
			}
		);

		expect(confirmation.hasLensItems).toBe(false);
		expect(confirmation.items).toEqual([]);
	});

	it('accepts numeric prescription values without crashing while editing', () => {
		const confirmation = buildStep2PrescriptionConfirmation(
			[makeConfirmationLensRow()],
			[makeLensItem()],
			{
				odSphere: 1,
				odCylinder: -0.5,
				odAxis: 90,
				odAddition: 0,
				oiSphere: '',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.MONOFOCAL
			}
		);

		expect(confirmation.items[0]?.eyes[0]?.prescriptionSummary).toContain('Esf +1.00');
	});
});

describe('getLensTypeSuggestionState', () => {
	it('returns the single catalog lens type when all selected lenses match', () => {
		const firstRow = makeConfirmationLensRow('row-1');
		const secondRow = makeConfirmationLensRow('row-2');

		const state = getLensTypeSuggestionState(
			[firstRow, secondRow],
			[makeLensItem(), makeLensItem({ id: 'lens-2' })],
			null
		);

		expect(state.catalogLensType).toBe(LensType.MONOFOCAL);
		expect(state.hasMixedCatalogLensTypes).toBe(false);
	});

	it('flags a conflict when the existing prescription type differs from the selected catalog lens', () => {
		const state = getLensTypeSuggestionState(
			[makeConfirmationLensRow()],
			[makeLensItem({ type: LensType.PROGRESSIVE })],
			LensType.MONOFOCAL
		);

		expect(state.catalogLensType).toBe(LensType.PROGRESSIVE);
		expect(state.conflictingPrescriptionLensType).toBe(LensType.MONOFOCAL);
	});

	it('detects mixed lens types and disables automatic single-type suggestion', () => {
		const firstRow = makeConfirmationLensRow('row-1');
		const secondRow = makeConfirmationLensRow('row-2');
		secondRow.lensPair!.catalogItemId = 'lens-2';

		const state = getLensTypeSuggestionState(
			[firstRow, secondRow],
			[
				makeLensItem({ id: 'lens-1', type: LensType.MONOFOCAL }),
				makeLensItem({ id: 'lens-2', type: LensType.PROGRESSIVE })
			],
			LensType.MONOFOCAL
		);

		expect(state.catalogLensType).toBeNull();
		expect(state.hasMixedCatalogLensTypes).toBe(true);
		expect(state.catalogLensTypes).toEqual([LensType.MONOFOCAL, LensType.PROGRESSIVE]);
	});
});

// ── Helpers ─────────────────────────────────────────────────────────────

function makeProductRow(overrides: Partial<SaleItemRow> = {}): SaleItemRow {
	const { freeItem, ...rest } = overrides;

	return {
		id: 'item-1',
		kind: 'product',
		productId: 'prod-1',
		quantity: 1,
		lensPair: null,
		treatments: [],
		unitPrice: 100,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		costOverrides: null,
		shippingCostPending: false,
		...rest,
		freeItem: freeItem ?? null
	};
}

function makeLensRow(treatments: SelectedTreatment[] = []): SaleItemRow {
	const pair = createEmptyLensPair();
	pair.catalogItemId = 'lens-1';
	return {
		id: 'item-2',
		kind: 'lens',
		productId: '',
		quantity: 1,
		lensPair: pair,
		treatments,
		freeItem: null,
		unitPrice: 50,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		costOverrides: null,
		shippingCostPending: false
	};
}

function makeTreatment(price: number, name = 'AR Angel'): SelectedTreatment {
	return {
		supplierTreatmentId: crypto.randomUUID(),
		name,
		category: 'AR',
		price,
		isTaxable: true
	};
}

function makeStockProduct(id: string, stock: number | null): ProductWithRelations {
	return {
		id,
		name: id,
		stock,
		currentSalePrice: 0,
		type: 'FRAME'
	} as ProductWithRelations;
}

// ── itemLineTotal (excludes treatments - they are separate) ─────────────

describe('itemLineTotal', () => {
	it('computes product line total correctly', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 85, quantity: 2 }))).toBe(170);
	});

	it('applies fixed discount on product', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 100, quantity: 1, discount: 10 }))).toBe(90);
	});

	it('applies percentage discount on product', () => {
		expect(
			itemLineTotal(
				makeProductRow({
					unitPrice: 200,
					quantity: 1,
					discount: 10,
					discountType: DiscountType.PERCENTAGE
				})
			)
		).toBe(180);
	});

	it('computes lens line total (qty always 1)', () => {
		const lens = makeLensRow();
		lens.unitPrice = 80;
		expect(itemLineTotal(lens)).toBe(80);
	});

	it('handles zero price', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 0 }))).toBe(0);
	});

	it('clamps fixed discount to the row total for display calculations', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 30, quantity: 1, discount: 50 }))).toBe(0);
	});

	it('clamps percentage discount above 100% for display calculations', () => {
		expect(
			itemLineTotal(
				makeProductRow({
					unitPrice: 30,
					quantity: 1,
					discount: 200,
					discountType: DiscountType.PERCENTAGE
				})
			)
		).toBe(0);
	});
});

describe('step2ItemLineTotal', () => {
	it('ignores discounts for product rows in Step 2', () => {
		expect(
			step2ItemLineTotal(
				makeProductRow({
					unitPrice: 120,
					quantity: 2,
					discount: 25,
					discountType: DiscountType.FIXED
				})
			)
		).toBe(240);
	});

	it('uses a single quantity for lens rows', () => {
		const lens = makeLensRow();
		lens.unitPrice = 95;

		expect(step2ItemLineTotal(lens)).toBe(95);
	});
});

// ── treatmentsTotal (used in Step 2 and Step 3) ─────────────────────────

describe('treatmentsTotal', () => {
	// This function is defined inline in Step 2 and Step 3 - test the logic here
	function treatmentsTotal(item: SaleItemRow): number {
		return item.treatments.reduce((sum, t) => sum + t.price, 0);
	}

	it('returns 0 when no treatments', () => {
		expect(treatmentsTotal(makeLensRow())).toBe(0);
	});

	it('sums single treatment', () => {
		expect(treatmentsTotal(makeLensRow([makeTreatment(15)]))).toBe(15);
	});

	it('sums multiple treatments', () => {
		const treatments = [makeTreatment(15, 'AR Angel'), makeTreatment(8, 'Bluecut')];
		expect(treatmentsTotal(makeLensRow(treatments))).toBe(23);
	});
});

// ── Full subtotal (Step 3 logic) ────────────────────────────────────────
// Note: item.unitPrice for lenses is set by recalcSuggestedPrice which
// already includes treatments. The subtotal is just sum(itemLineTotal).

describe('subtotal (Step 3)', () => {
	function subtotal(items: SaleItemRow[]): number {
		return items.reduce((acc, item) => acc + itemLineTotal(item), 0);
	}

	it('computes subtotal with product only', () => {
		const items = [makeProductRow({ unitPrice: 85, quantity: 2 })];
		expect(subtotal(items)).toBe(170);
	});

	it('computes subtotal with lens (unitPrice includes treatments)', () => {
		// unitPrice = basePrice + mounting + shipping + treatments = 50 + 15 + 8
		const lens = makeLensRow([makeTreatment(15), makeTreatment(8)]);
		lens.unitPrice = 73; // already includes treatments
		expect(subtotal([lens])).toBe(73);
	});

	it('computes subtotal with product + lens', () => {
		const product = makeProductRow({ unitPrice: 85, quantity: 1 });
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 65; // already includes treatment
		expect(subtotal([product, lens])).toBe(85 + 65);
	});

	it('applies discount to full lens unitPrice (which includes treatments)', () => {
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 115; // base cost + treatment already included
		lens.discount = 10;
		lens.discountType = DiscountType.FIXED;
		// itemLineTotal = 115 - 10 = 105
		expect(subtotal([lens])).toBe(105);
	});
});

// ── computeItemDiscount ─────────────────────────────────────────────────

describe('computeItemDiscount', () => {
	it('returns 0 when discount is 0', () => {
		expect(computeItemDiscount(makeProductRow())).toBe(0);
	});

	it('returns fixed discount amount', () => {
		expect(computeItemDiscount(makeProductRow({ discount: 15 }))).toBe(15);
	});

	it('returns percentage based on line total', () => {
		expect(
			computeItemDiscount(
				makeProductRow({
					unitPrice: 200,
					quantity: 2,
					discount: 10,
					discountType: DiscountType.PERCENTAGE
				})
			)
		).toBe(40); // 10% of 400
	});

	it('flags fixed discounts above the row total as invalid', () => {
		expect(isItemDiscountValid(makeProductRow({ unitPrice: 30, discount: 50 }))).toBe(false);
		expect(getItemDiscountMax(makeProductRow({ unitPrice: 30, discount: 50 }))).toBe(30);
	});

	it('flags percentage discounts above 100 as invalid', () => {
		expect(
			isItemDiscountValid(makeProductRow({ discount: 120, discountType: DiscountType.PERCENTAGE }))
		).toBe(false);
		expect(
			getItemDiscountMax(makeProductRow({ discount: 120, discountType: DiscountType.PERCENTAGE }))
		).toBe(100);
	});
});

describe('calculateSaleSummarySubtotal', () => {
	it('includes treatments and clamps invalid row discounts', () => {
		const product = makeProductRow({ unitPrice: 30, discount: 50 });
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 25;

		expect(calculateSaleSummarySubtotal([product, lens])).toBe(55);
	});
});

describe('aggregate product stock helpers', () => {
	it('sums requested quantity for the same product across rows', () => {
		const items = [
			makeProductRow({ id: 'item-a', productId: 'prod-1', quantity: 2 }),
			makeProductRow({ id: 'item-b', productId: 'prod-1', quantity: 1 }),
			makeProductRow({ id: 'item-c', productId: 'prod-2', quantity: 3 })
		];

		expect(getRequestedProductQuantity(items, 'prod-1')).toBe(3);
		expect(getRequestedProductQuantity(items, 'prod-1', 'item-a')).toBe(1);
	});

	it('returns remaining stock excluding the current row quantity', () => {
		const items = [
			makeProductRow({ id: 'item-a', productId: 'prod-1', quantity: 1 }),
			makeProductRow({ id: 'item-b', productId: 'prod-1', quantity: 2 })
		];
		const products = [makeStockProduct('prod-1', 4)];

		expect(getAvailableProductStock(items, products, 'prod-1', 'item-a')).toBe(2);
		expect(getAvailableProductStock(items, products, 'prod-1', 'item-b')).toBe(3);
	});

	it('returns zero when other rows already reserved the full stock', () => {
		const items = [
			makeProductRow({ id: 'item-a', productId: 'prod-1', quantity: 4 }),
			makeProductRow({ id: 'item-b', productId: 'prod-1', quantity: 1 })
		];
		const products = [makeStockProduct('prod-1', 4)];

		expect(getAvailableProductStock(items, products, 'prod-1', 'item-b')).toBe(0);
	});
});
