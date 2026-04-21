import { describe, expect, it } from 'vitest';

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { PurchaseDocumentType, PurchaseOrderItemType } from '$lib/shared/enums';
import { LensPriceType, LensType } from '$lib/shared/enums/lensTypes';

import {
	applyLensDefaults,
	applyProductDefaults,
	calculatePurchaseOrderSummary,
	createEmptyPurchaseOrderDraftItem
} from './purchaseOrderDraft';

function makeProduct(overrides: Partial<ProductWithRelations> = {}): ProductWithRelations {
	return {
		id: 'product-1',
		sku: 'MON-001',
		name: 'Montura acetato',
		currentPurchasePrice: 18,
		currentSalePrice: 42,
		isTaxable: true,
		supplierId: 'supplier-1',
		brand: { name: 'Optikt' },
		supplier: { name: 'Distribuidora Norte' },
		...overrides
	} as ProductWithRelations;
}

function makeLens(
	overrides: Partial<LensCatalogItemWithRelations> = {}
): LensCatalogItemWithRelations {
	return {
		id: 'lens-1',
		name: 'Blue Cut 1.56',
		type: LensType.MONOFOCAL,
		priceType: LensPriceType.PAIR,
		pairPurchasePrice: 24,
		basePrice: 14,
		salePrice: 52,
		isTaxable: false,
		supplierId: 'supplier-1',
		material: { name: 'CR-39' },
		supplier: { name: 'Lab Express' },
		...overrides
	} as LensCatalogItemWithRelations;
}

describe('purchaseOrderDraft helpers', () => {
	it('creates a product draft row by default', () => {
		const item = createEmptyPurchaseOrderDraftItem();

		expect(item.itemType).toBe(PurchaseOrderItemType.PRODUCT);
		expect(item.quantity).toBe(1);
		expect(item.appliesIva).toBe(true);
		expect(item.ivaRate).toBe(16);
	});

	it('creates an exempt draft row for delivery note', () => {
		const item = createEmptyPurchaseOrderDraftItem(
			PurchaseOrderItemType.PRODUCT,
			PurchaseDocumentType.DELIVERY_NOTE
		);

		expect(item.appliesIva).toBe(false);
		expect(item.ivaRate).toBe(16);
	});

	it('hydrates product defaults into a draft row', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		applyProductDefaults(item, makeProduct());

		expect(item.productId).toBe('product-1');
		expect(item.lensCatalogItemId).toBe('');
		expect(item.unitPurchasePrice).toBe(20.88);
		expect(item.unitSalePrice).toBe(42);
		expect(item.appliesIva).toBe(true);
		expect(item.ivaRate).toBe(16);
	});

	it('hydrates product defaults as exempt for delivery note', () => {
		const item = createEmptyPurchaseOrderDraftItem(
			PurchaseOrderItemType.PRODUCT,
			PurchaseDocumentType.DELIVERY_NOTE
		);
		applyProductDefaults(
			item,
			makeProduct({ isTaxable: true }),
			PurchaseDocumentType.DELIVERY_NOTE
		);

		expect(item.appliesIva).toBe(false);
	});

	it('hydrates lens defaults using pair purchase price when applicable', () => {
		const item = createEmptyPurchaseOrderDraftItem(PurchaseOrderItemType.LENS);
		applyLensDefaults(item, makeLens());

		expect(item.itemType).toBe(PurchaseOrderItemType.LENS);
		expect(item.productId).toBe('');
		expect(item.lensCatalogItemId).toBe('lens-1');
		expect(item.unitPurchasePrice).toBe(24);
		expect(item.unitSalePrice).toBe(52);
		expect(item.appliesIva).toBe(false);
	});

	it('calculates the draft summary totals', () => {
		const productItem = createEmptyPurchaseOrderDraftItem();
		applyProductDefaults(
			productItem,
			makeProduct({ currentPurchasePrice: 10, currentSalePrice: 25 })
		);
		productItem.quantity = 2;

		const lensItem = createEmptyPurchaseOrderDraftItem(PurchaseOrderItemType.LENS);
		applyLensDefaults(
			lensItem,
			makeLens({ pairPurchasePrice: 30, salePrice: 60, isTaxable: false })
		);
		lensItem.quantity = 1;

		const summary = calculatePurchaseOrderSummary([productItem, lensItem]);

		expect(summary.lineCount).toBe(2);
		expect(summary.totalUnits).toBe(3);
		expect(summary.subtotal).toBe(50);
		expect(summary.taxAmount).toBeCloseTo(3.2);
		expect(summary.total).toBeCloseTo(53.2);
		expect(summary.estimatedSale).toBe(110);
		expect(summary.estimatedProfit).toBeCloseTo(56.8);
	});
});
