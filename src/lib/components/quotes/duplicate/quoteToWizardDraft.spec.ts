import { describe, expect, it } from 'vitest';
import { quoteToWizardDraft } from './quoteToWizardDraft';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { QuoteItemWithDetails, QuoteWithRelations } from '$lib/server/db/queries/quotes/types';

const quote = {
	id: 'q-1',
	quoteNumber: 231,
	discount: 20,
	discountType: 'FIXED',
	notes: 'Cliente pide montura liviana',
	isCashea: true,
	customer: null,
	seller: null,
	convertedOrderNumber: null,
	createdAt: '2026-11-14T20:10:00Z',
	quoteDate: '2026-11-14T20:10:00Z',
	status: 'DRAFT',
	subtotal: 385,
	snapshotTaxRate: 16,
	total: 385,
	validUntil: null,
	conversionSaleId: null,
	sourceQuoteId: null,
	deletedAt: null,
	updatedAt: ''
} as unknown as QuoteWithRelations;

function item(partial: Partial<QuoteItemWithDetails>): QuoteItemWithDetails {
	return {
		id: 'qi-1',
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
		unitPrice: 280,
		discount: 0,
		discountType: 'FIXED',
		snapshotName: 'American Specs MM2090 C3',
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
		product: null,
		lensCatalogItem: null,
		supplierTreatment: null,
		freeDetails: null,
		...partial
	};
}

describe('quoteToWizardDraft', () => {
	it('copia descuento, Cashea y notas; resetea cliente/fecha/validez', () => {
		const draft = quoteToWizardDraft({
			quote,
			items: [item({})]
		});
		expect(draft.discount).toBe(20);
		expect(draft.discountType).toBe('FIXED');
		expect(draft.isCashea).toBe(true);
		expect(draft.notes).toBe('Cliente pide montura liviana');
	});

	it('mapea producto, lente con fórmula (incluida altura) e ítem libre', () => {
		const draft = quoteToWizardDraft({
			quote,
			items: [
				item({ id: 'p-row', productId: 'p-1' }),
				item({
					id: 'lens-row',
					itemType: SaleItemType.LENS_PAIR,
					productId: null,
					lensCatalogItemId: 'lc-1',
					odSphere: -1.25,
					odCylinder: -0.5,
					odAxis: 15,
					odAltura: 22,
					osSphere: -1.5,
					osCylinder: -0.5,
					osAxis: 15,
					osAltura: 21,
					snapshotBaseCost: 40,
					snapshotMountingPrice: 5,
					snapshotShippingPrice: 3,
					lensCatalogItem: { id: 'lc-1', name: 'Nueva Vision 1.67', type: 'MONOFOCAL' }
				}),
				item({
					id: 'free-row',
					itemType: SaleItemType.FREE_ITEM,
					productId: null,
					unitPrice: 15,
					freeDetails: {
						id: 'fd-1',
						quoteItemId: 'free-row',
						category: 'ACCESORY',
						description: 'Estuche rígido personalizado',
						enrichmentStatus: 'PENDING',
						unitCost: null,
						supplierId: null,
						opticalNotes: null,
						enrichedAt: null,
						enrichedById: null,
						createdAt: '',
						updatedAt: ''
					}
				})
			]
		});

		expect(draft.items).toHaveLength(3);
		const product = draft.items.find((r) => r.kind === 'product');
		expect(product?.unitPrice).toBe(280);

		const lens = draft.items.find((r) => r.kind === 'lens');
		expect(lens?.lensPair?.od.prescription.sphere).toBe(-1.25);
		expect(lens?.lensPair?.od.altura).toBe(22);
		expect(lens?.lensPair?.oi.altura).toBe(21);
		expect(lens?.lensPair?.od.enabled).toBe(true);
		expect(lens?.lensPair?.catalogItemId).toBe('lc-1');

		const free = draft.items.find((r) => r.kind === 'free');
		expect(free?.freeItem?.description).toBe('Estuche rígido personalizado');
	});

	it('cuelga los tratamientos hijos bajo su lente padre', () => {
		const draft = quoteToWizardDraft({
			quote,
			items: [
				item({
					id: 'lens-1',
					itemType: SaleItemType.LENS_PAIR,
					productId: null,
					lensCatalogItemId: 'lc-1',
					odSphere: -1,
					lensCatalogItem: { id: 'lc-1', name: 'Nueva Vision', type: 'MONOFOCAL' }
				}),
				item({
					id: 't-1',
					itemType: SaleItemType.TREATMENT,
					productId: null,
					parentQuoteItemId: 'lens-1',
					supplierTreatmentId: 'st-1',
					unitPrice: 20,
					snapshotName: 'Blue cut'
				})
			]
		});

		expect(draft.items).toHaveLength(2);
		const treatment = draft.items.find((r) => r.kind === 'treatment');
		expect(treatment?.parentLensItemId).toBe('lens-1');
		expect(treatment?.treatmentName).toBe('Blue cut');
		// El tratamiento va inmediatamente después de su lente
		expect(draft.items.indexOf(treatment!)).toBe(1);
	});
});
