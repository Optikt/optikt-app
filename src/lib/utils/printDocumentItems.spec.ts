import { describe, expect, it } from 'vitest';
import { SaleItemType, TreatmentCategory } from '$lib/shared/enums/lensTypes';
import {
	getPrintItemLabel,
	getPrintItemLabelClass,
	getPrintLensRxSummary,
	hasHalfLetterReceiptOverflowRisk,
	type PrintDocumentItem
} from './printDocumentItems';

function makeItem(overrides: Partial<PrintDocumentItem>): PrintDocumentItem {
	return {
		itemType: SaleItemType.PRODUCT,
		snapshotName: null,
		product: null,
		lensCatalogItem: null,
		supplierTreatment: null,
		freeDetails: null,
		odSphere: null,
		odCylinder: null,
		odAxis: null,
		odAddition: null,
		osSphere: null,
		osCylinder: null,
		osAxis: null,
		osAddition: null,
		...overrides
	};
}

describe('printDocumentItems', () => {
	it('formats product labels from product name', () => {
		const item = makeItem({
			itemType: SaleItemType.PRODUCT,
			product: { name: 'American Specs AS-002' }
		});

		expect(getPrintItemLabel(item)).toBe('American Specs AS-002');
		expect(getPrintItemLabelClass(item)).toBe('font-medium text-slate-950');
	});

	it('formats lens labels with generic descriptors', () => {
		const item = makeItem({
			itemType: SaleItemType.LENS_PAIR,
			snapshotName: 'Cristales policarbonato progresivos fotocromáticos antirreflejo'
		});

		expect(getPrintItemLabel(item)).toBe('Cristal Policarbonato Progresivo Fotocromático AR');
		expect(getPrintItemLabelClass(item)).toBe('font-normal text-slate-950');
	});

	it('formats treatment labels by category', () => {
		const item = makeItem({
			itemType: SaleItemType.TREATMENT,
			supplierTreatment: { name: 'Max CleAR', category: TreatmentCategory.AR }
		});

		expect(getPrintItemLabel(item)).toBe('Antireflejo: Max CleAR');
	});

	it('formats rx summary for both eyes', () => {
		const item = makeItem({
			itemType: SaleItemType.LENS_PAIR,
			odSphere: 0.5,
			odCylinder: -0.25,
			odAxis: 90,
			odAddition: 1.5,
			osSphere: -0.25,
			osCylinder: 0,
			osAxis: null,
			osAddition: null
		});

		expect(getPrintLensRxSummary(item)).toBe('OD: +0.50 -0.25 90° Add +1.50 · OI: -0.25');
	});

	it('flags receipts that are likely to exceed half letter', () => {
		expect(hasHalfLetterReceiptOverflowRisk({ itemLineCount: 3, paymentCount: 4 })).toBe(false);
		expect(hasHalfLetterReceiptOverflowRisk({ itemLineCount: 6, paymentCount: 1 })).toBe(true);
		expect(hasHalfLetterReceiptOverflowRisk({ itemLineCount: 2, paymentCount: 6 })).toBe(true);
		expect(hasHalfLetterReceiptOverflowRisk({ itemLineCount: 5, paymentCount: 5 })).toBe(true);
	});
});
