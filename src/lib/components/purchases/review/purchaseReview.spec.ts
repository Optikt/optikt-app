import { describe, expect, it } from 'vitest';
import {
	PurchaseDiscountType,
	PurchaseDocumentType,
	PurchaseOrderItemType,
	PurchasePaymentTerms,
	PurchaseSourceCurrency
} from '$lib/shared/enums';
import { cacheCatalogItems } from '../../sales/catalogCache.svelte';
import type { PurchaseOrderDraftItem } from '../purchaseOrderDraft';
import {
	buildItemsPayload,
	buildPurchaseOrderPayload,
	buildUnreviewedWarningLine,
	buildWarningLines,
	buildZeroValueWarningLine,
	canSavePurchaseOrder,
	getDraftItemTitle,
	getItemSku,
	hasDraftWarnings,
	isStepValid,
	type StepValidationInput
} from './purchaseReview';

cacheCatalogItems(
	[{ id: 'p-1', sku: 'SKU-1', name: 'Montura' } as never],
	[{ id: 'l-1', name: 'Cristal', material: { name: 'Poly' } } as never]
);

function product(overrides: Partial<PurchaseOrderDraftItem> = {}): PurchaseOrderDraftItem {
	return {
		id: 'row-1',
		itemType: PurchaseOrderItemType.PRODUCT,
		productId: 'p-1',
		quantity: 2,
		unitPurchasePrice: 10,
		unitSalePrice: 25,
		...overrides
	} as PurchaseOrderDraftItem;
}

describe('getDraftItemTitle / getItemSku', () => {
	it('resolves cached names', () => {
		expect(getDraftItemTitle(product())).toBe('SKU-1 - Montura');
		expect(getItemSku(product())).toBe('SKU-1');
		expect(
			getDraftItemTitle(product({ itemType: PurchaseOrderItemType.LENS, lensCatalogItemId: 'l-1' }))
		).toBe('Cristal');
		expect(
			getItemSku(product({ itemType: PurchaseOrderItemType.LENS, lensCatalogItemId: 'l-1' }))
		).toBe('Poly');
	});

	it('falls back for unknown items', () => {
		expect(getDraftItemTitle(product({ productId: 'missing' }))).toBe('Producto seleccionado');
		expect(getItemSku(product({ productId: 'missing' }))).toBe('');
	});
});

describe('warning line builders', () => {
	it('builds zero-value lines only with zero fields', () => {
		const zero = buildZeroValueWarningLine(product({ unitPurchasePrice: 0, unitSalePrice: 0 }));

		expect(zero).toMatchObject({
			id: 'row-1',
			title: 'SKU-1 - Montura',
			quantity: 2,
			fields: ['unitPurchasePrice', 'unitSalePrice']
		});
		expect(buildZeroValueWarningLine(product())).toBeNull();
	});

	it('builds unreviewed lines', () => {
		expect(buildUnreviewedWarningLine(product())).toMatchObject({
			id: 'row-1',
			title: 'SKU-1 - Montura',
			quantity: 2
		});
	});

	it('aggregates both warning lists', () => {
		const lines = buildWarningLines([
			product({ id: 'a', isReviewed: false }),
			product({ id: 'b', isReviewed: true, unitPurchasePrice: 0, unitSalePrice: 0 })
		]);

		expect(lines.unreviewed.map((l) => l.id)).toEqual(['a']);
		expect(lines.zeroValue.map((l) => l.id)).toEqual(['b']);
	});
});

function validStepInput(overrides: Partial<StepValidationInput> = {}): StepValidationInput {
	return {
		supplierId: 'sup-1',
		orderDate: '2026-09-01',
		bcvRate: 200,
		notes: 'Nota válida',
		settlementCurrency: 'USD_BCV',
		documentType: PurchaseDocumentType.INVOICE,
		invoiceNumber: 'F-1',
		deliveryNoteNumber: '',
		paymentTerms: PurchasePaymentTerms.CONTADO,
		creditDueDate: null,
		discountType: PurchaseDiscountType.NONE,
		discountValue: 0,
		sourceCurrency: PurchaseSourceCurrency.USD,
		sourceRateToVes: 0,
		items: [],
		...overrides
	};
}

describe('isStepValid', () => {
	it('validates step 1 field by field', () => {
		expect(isStepValid(1, validStepInput())).toBe(true);
		expect(isStepValid(1, validStepInput({ supplierId: '' }))).toBe(false);
		expect(isStepValid(1, validStepInput({ bcvRate: 0 }))).toBe(false);
		expect(isStepValid(1, validStepInput({ notes: 'abc' }))).toBe(false);
		expect(
			isStepValid(
				1,
				validStepInput({ paymentTerms: PurchasePaymentTerms.CREDIT, creditDueDate: null })
			)
		).toBe(false);
		expect(
			isStepValid(
				1,
				validStepInput({
					paymentTerms: PurchasePaymentTerms.CREDIT,
					creditDueDate: '2026-10-01'
				})
			)
		).toBe(true);
		expect(
			isStepValid(
				1,
				validStepInput({ documentType: PurchaseDocumentType.DELIVERY_NOTE, invoiceNumber: '' })
			)
		).toBe(false);
	});

	it('requires reviewed items on step 2 and passes step 3', () => {
		expect(isStepValid(2, validStepInput({ items: [] }))).toBe(false);
		expect(isStepValid(2, validStepInput({ items: [product({ isReviewed: true })] }))).toBe(true);
		expect(isStepValid(2, validStepInput({ items: [product({ isReviewed: false })] }))).toBe(false);
		expect(isStepValid(3, validStepInput())).toBe(true);
		expect(isStepValid(9, validStepInput())).toBe(false);
	});
});

describe('save guards', () => {
	function saveInput(items: PurchaseOrderDraftItem[]) {
		return {
			header: {
				supplierId: 'sup-1',
				orderDate: '2026-09-01',
				bcvRate: 200,
				notes: 'Nota válida',
				sourceCurrency: PurchaseSourceCurrency.USD,
				sourceRateToVes: 0
			},
			items,
			terms: {
				paymentTerms: PurchasePaymentTerms.CONTADO,
				creditDueDate: null,
				earlyPaymentDiscountPercent: null,
				earlyPaymentDiscountDeadline: null
			}
		};
	}

	it('detects draft warnings', () => {
		expect(hasDraftWarnings([product({ isReviewed: true })])).toBe(false);
		expect(hasDraftWarnings([product({ isReviewed: false })])).toBe(true);
		expect(
			hasDraftWarnings([product({ isReviewed: true, unitPurchasePrice: 0, unitSalePrice: 0 })])
		).toBe(true);
	});

	it('delegates save eligibility', () => {
		expect(canSavePurchaseOrder(saveInput([product()]))).toBe(true);
		expect(canSavePurchaseOrder(saveInput([]))).toBe(false);
	});
});

describe('payload builders', () => {
	it('maps items with currency rules', () => {
		const [row] = buildItemsPayload([product()], PurchaseSourceCurrency.USD);

		expect(row).toMatchObject({
			itemType: PurchaseOrderItemType.PRODUCT,
			productId: 'p-1',
			unitPurchasePriceAlt: undefined
		});

		const [alt] = buildItemsPayload([product()], PurchaseSourceCurrency.USDT);
		expect(alt.unitPurchasePriceAlt).toBe(0);
	});

	it('builds order payload with discount notes', () => {
		const payload = buildPurchaseOrderPayload({
			supplierId: 'sup-1',
			documentType: PurchaseDocumentType.INVOICE,
			invoiceNumber: '',
			deliveryNoteNumber: '',
			orderDate: '2026-09-01',
			bcvRate: 200,
			sourceCurrency: PurchaseSourceCurrency.USD,
			sourceRateToVes: 0,
			settlementCurrency: 'USD_BCV',
			paymentTerms: PurchasePaymentTerms.CONTADO,
			creditDueDate: null,
			earlyPaymentDiscountPercent: null,
			earlyPaymentDiscountDeadline: null,
			notes: 'n',
			discount: { type: PurchaseDiscountType.NONE, value: 0 },
			discountNotes: '',
			items: [product()]
		});

		expect(payload.invoiceNumber).toBeUndefined();
		expect(payload.discount).toEqual({ type: 'NONE', value: 0, notes: undefined });
		expect(payload.items.length).toBe(1);
	});
});
