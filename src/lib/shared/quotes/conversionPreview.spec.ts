import { describe, expect, it } from 'vitest';
import { buildQuoteConversionPreview, type QuoteConversionItemRow } from './conversionPreview';
import { LensInventoryMode, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { QuoteItem } from '$lib/server/db/schema';

function item(partial: Partial<QuoteItem>): QuoteItem {
	return {
		id: 'q-item-1',
		quoteId: 'q-1',
		itemType: SaleItemType.PRODUCT,
		productId: null,
		lensCatalogItemId: null,
		parentQuoteItemId: null,
		supplierTreatmentId: null,
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
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: 'FIXED',
		snapshotName: null,
		snapshotSku: null,
		snapshotBrand: null,
		snapshotBaseCost: null,
		snapshotMountingPrice: null,
		snapshotShippingPrice: null,
		snapshotSalePrice: null,
		snapshotPriceType: null,
		snapshotTreatmentCategory: null,
		snapshotIsTaxable: null,
		notes: null,
		deletedAt: null,
		createdAt: '',
		updatedAt: '',
		...partial
	};
}

function row(partial: Partial<QuoteConversionItemRow>): QuoteConversionItemRow {
	return {
		item: item({}),
		label: 'Ítem',
		product: null,
		lens: null,
		treatment: null,
		...partial
	};
}

describe('buildQuoteConversionPreview', () => {
	it('PRODUCT con stock suficiente → ok con disponible', () => {
		const preview = buildQuoteConversionPreview(
			[
				row({
					item: item({ itemType: SaleItemType.PRODUCT, unitPrice: 280, quantity: 3 }),
					label: 'American Specs MM2090 C3',
					product: { currentSalePrice: 280, stock: 3 }
				})
			],
			{ hasCustomer: true }
		);
		expect(preview.items[0].stock).toEqual({ kind: 'ok', available: 3, needed: 3 });
		expect(preview.summary).toEqual({
			allStockOk: true,
			priceChangedCount: 0,
			missingCustomer: false
		});
	});

	it('PRODUCT con stock insuficiente → insufficient + allStockOk false', () => {
		const preview = buildQuoteConversionPreview(
			[
				row({
					item: item({ itemType: SaleItemType.PRODUCT, unitPrice: 280, quantity: 5 }),
					label: 'American Specs',
					product: { currentSalePrice: 280, stock: 2 }
				})
			],
			{ hasCustomer: true }
		);
		expect(preview.items[0].stock).toEqual({ kind: 'insufficient', available: 2, needed: 5 });
		expect(preview.summary.allStockOk).toBe(false);
	});

	it('lente STOCK sin stock → insufficient; lente ON_DEMAND → untracked', () => {
		const preview = buildQuoteConversionPreview(
			[
				row({
					item: item({ itemType: SaleItemType.LENS_PAIR, unitPrice: 90 }),
					label: 'Nueva Vision 1.67',
					lens: {
						currentSalePrice: 90,
						pairPurchasePrice: 40,
						mountingPrice: 5,
						shippingPrice: 3,
						stock: 0,
						inventoryMode: LensInventoryMode.STOCK
					}
				}),
				row({
					item: item({ id: 'q-2', itemType: SaleItemType.LENS_PAIR, unitPrice: 45 }),
					label: 'Essilor CR-39',
					lens: {
						currentSalePrice: 45,
						pairPurchasePrice: 20,
						mountingPrice: 2,
						shippingPrice: 1,
						stock: null,
						inventoryMode: LensInventoryMode.ON_DEMAND
					}
				})
			],
			{ hasCustomer: true }
		);
		expect(preview.items[0].stock.kind).toBe('insufficient');
		expect(preview.items[1].stock.kind).toBe('untracked');
		expect(preview.summary.allStockOk).toBe(false);
	});

	it('precio cambió en catálogo → changed con USD 280 → 295', () => {
		const preview = buildQuoteConversionPreview(
			[
				row({
					item: item({ itemType: SaleItemType.PRODUCT, unitPrice: 280 }),
					label: 'MM2090 C3',
					product: { currentSalePrice: 295, stock: 10 }
				})
			],
			{ hasCustomer: true }
		);
		expect(preview.items[0].price).toEqual({ quoted: 280, current: 295, changed: true });
		expect(preview.summary.priceChangedCount).toBe(1);
	});

	it('precio igual (tolerancia de centavos) → changed false', () => {
		const preview = buildQuoteConversionPreview(
			[
				row({
					item: item({ unitPrice: 280.0005 }),
					label: 'MM2090 C3',
					product: { currentSalePrice: 280, stock: 10 }
				})
			],
			{ hasCustomer: true }
		);
		expect(preview.items[0].price.changed).toBe(false);
	});

	it('ítem libre / tratamiento sin control → untracked y sin comparación de precio', () => {
		const preview = buildQuoteConversionPreview(
			[
				row({
					item: item({ itemType: SaleItemType.FREE_ITEM, unitPrice: 15 }),
					label: 'Estuche rígido'
				}),
				row({
					item: item({
						id: 'q-2',
						itemType: SaleItemType.TREATMENT,
						unitPrice: 20,
						supplierTreatmentId: 't-1'
					}),
					label: 'Blue cut',
					treatment: { currentSalePrice: 20 }
				})
			],
			{ hasCustomer: true }
		);
		expect(preview.items[0].stock.kind).toBe('untracked');
		expect(preview.items[0].price.current).toBeNull();
		expect(preview.items[1].stock.kind).toBe('untracked');
	});

	it('falta el cliente → summary.missingCustomer', () => {
		const preview = buildQuoteConversionPreview([], { hasCustomer: false });
		expect(preview.summary.missingCustomer).toBe(true);
	});
});
