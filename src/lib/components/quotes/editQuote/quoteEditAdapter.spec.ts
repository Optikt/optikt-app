import { describe, expect, it } from 'vitest';
import {
	buildQuoteUpdatePayload,
	editableToQuoteItem,
	quoteHasChanges,
	quoteItemToEditable,
	type QuoteEditDraft
} from './quoteEditAdapter';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes/types';

function quoteItem(overrides: Partial<QuoteItemWithDetails> = {}): QuoteItemWithDetails {
	return {
		id: 'item-1',
		quoteId: 'q-1',
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
		unitPrice: 20,
		discount: 0,
		discountType: 'FIXED',
		snapshotName: 'Montura',
		snapshotSku: 'SKU-1',
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
		product: null,
		lensCatalogItem: null,
		supplierTreatment: null,
		freeDetails: null,
		...overrides
	};
}

const quote = {
	id: 'q-1',
	// 01:30 UTC del 15/11 = 21:30 VET del 14/11: el día de negocio es el 14.
	// Usar createdAt.slice(0,10) o UTC aquí cambiaría la fecha un día.
	quoteDate: '2026-11-15T01:30:00.000Z',
	createdAt: '2026-11-15T02:00:00.000Z',
	validUntil: null,
	notes: null,
	isCashea: false,
	discount: 0,
	discountType: 'FIXED'
};

function draft(overrides: Partial<QuoteEditDraft> = {}): QuoteEditDraft {
	return {
		dateIso: '2026-11-14',
		validUntilIso: '',
		notes: '',
		isCashea: false,
		discount: 0,
		discountType: 'FIXED',
		items: [],
		...overrides
	};
}

describe('quoteItemToEditable / editableToQuoteItem', () => {
	it('mapea parentQuoteItemId ⇄ parentSaleItemId y conserva la altura', () => {
		const editable = quoteItemToEditable(
			quoteItem({ parentQuoteItemId: 'parent-1', odAltura: 21, osAltura: 22 })
		);
		expect(editable.parentSaleItemId).toBe('parent-1');
		const back = editableToQuoteItem(editable);
		expect(back.parentQuoteItemId).toBe('parent-1');
		expect(back.odAltura).toBe(21);
		expect(back.osAltura).toBe(22);
	});
});

describe('quoteHasChanges', () => {
	it('usa quoteDate en día de negocio, no createdAt ni UTC', () => {
		expect(quoteHasChanges(quote, [], draft())).toEqual({ changed: false, itemsChanged: false });
		expect(quoteHasChanges(quote, [], draft({ dateIso: '2026-11-15' })).changed).toBe(true);
	});

	it('detecta cambios de notas, Cashea, descuento y validez', () => {
		expect(quoteHasChanges(quote, [], draft({ notes: 'nueva' })).changed).toBe(true);
		expect(quoteHasChanges(quote, [], draft({ isCashea: true })).changed).toBe(true);
		expect(quoteHasChanges(quote, [], draft({ discount: 10 })).changed).toBe(true);
		expect(quoteHasChanges(quote, [], draft({ validUntilIso: '2026-12-01' })).changed).toBe(true);
	});
});

describe('buildQuoteUpdatePayload', () => {
	it('omite quoteDate cuando no cambió el día de negocio', () => {
		const payload = buildQuoteUpdatePayload(quote, draft({ items: [] }));
		expect(payload.quoteDate).toBeUndefined();
		expect(payload).toMatchObject({ id: 'q-1', items: [] });
	});

	it('envía quoteDate cuando cambia y omite ítems eliminados', () => {
		const items = [
			quoteItemToEditable(quoteItem({ id: 'keep' })),
			quoteItemToEditable(quoteItem({ id: 'drop' }))
		];
		items[1]._removed = true;
		const payload = buildQuoteUpdatePayload(quote, draft({ dateIso: '2026-11-20', items }));
		expect(payload.quoteDate).toBe('2026-11-20');
		expect(payload.items).toHaveLength(1);
		expect(payload.items[0].id).toBe('keep');
	});

	it('norma validez vacía a null', () => {
		const payload = buildQuoteUpdatePayload({ ...quote, validUntil: '2026-12-01' }, draft());
		expect(payload.validUntil).toBeNull();
	});
});
