import { describe, expect, it } from 'vitest';
import { buildQuoteDisplayGroups, quoteItemToDisplayItem } from './quoteItemsAdapter';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes/types';

const QUOTE_ID = 'q-1';

function quoteItem(partial: Partial<QuoteItemWithDetails>): QuoteItemWithDetails {
	return {
		id: 'qi-1',
		quoteId: QUOTE_ID,
		itemType: SaleItemType.PRODUCT,
		productId: 'p-1',
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
		unitPrice: 280,
		discount: 0,
		discountType: 'FIXED',
		snapshotName: 'American Specs MM2090 C3',
		snapshotSku: 'MOCA-1',
		snapshotBrand: 'American Specs',
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
		product: { id: 'p-1', name: 'American Specs MM2090 C3', sku: 'MOCA-1', type: 'FRAME' },
		lensCatalogItem: null,
		supplierTreatment: null,
		freeDetails: null,
		...partial
	};
}

describe('quoteItemToDisplayItem', () => {
	it('mapea el ítem y deja en null los campos exclusivos de venta', () => {
		const display = quoteItemToDisplayItem(quoteItem({}), QUOTE_ID);
		expect(display.saleId).toBe(QUOTE_ID);
		expect(display.lotId).toBeNull();
		expect(display.prescriptionId).toBeNull();
		expect(display.dp).toBeNull();
		expect(display.npRight).toBeNull();
		expect(display.npLeft).toBeNull();
		expect(display.snapshotCostTotal).toBeNull();
		expect(display.shippingCostPending).toBe(false);
		expect(display.unitPrice).toBe(280);
		expect(display.snapshotName).toBe('American Specs MM2090 C3');
	});

	it('conserva la fórmula por ojo con altura (D6: la fórmula se ve por ítem)', () => {
		const display = quoteItemToDisplayItem(
			quoteItem({
				itemType: SaleItemType.LENS_PAIR,
				productId: null,
				odSphere: -1.25,
				odCylinder: -0.5,
				odAxis: 15,
				odAltura: 22,
				osSphere: -1.5
			}),
			QUOTE_ID
		);
		expect(display.odSphere).toBe(-1.25);
		expect(display.odAltura).toBe(22);
		expect(display.osSphere).toBe(-1.5);
	});
});

describe('buildQuoteDisplayGroups', () => {
	it('agrupa los tratamientos hijos bajo su lente padre', () => {
		const groups = buildQuoteDisplayGroups(
			[
				quoteItem({
					id: 'lens-1',
					itemType: SaleItemType.LENS_PAIR,
					productId: null,
					lensCatalogItemId: 'lc-1',
					product: null,
					lensCatalogItem: { id: 'lc-1', name: 'Nueva Vision 1.67', type: 'MONOFOCAL' }
				}),
				quoteItem({
					id: 't-1',
					itemType: SaleItemType.TREATMENT,
					productId: null,
					parentQuoteItemId: 'lens-1',
					supplierTreatmentId: 'st-1',
					unitPrice: 20
				}),
				quoteItem({ id: 'p-2', productId: 'p-2', unitPrice: 75 })
			],
			QUOTE_ID
		);

		expect(groups).toHaveLength(2);
		const lensGroup = groups.find((g) => g.item.id === 'lens-1');
		expect(lensGroup?.treatments).toHaveLength(1);
		expect(lensGroup?.treatments[0]?.id).toBe('t-1');
	});
});
