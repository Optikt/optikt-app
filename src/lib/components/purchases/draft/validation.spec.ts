import { describe, expect, it } from 'vitest';

import { PurchasePaymentTerms } from '$lib/shared/enums';

import { createEmptyPurchaseOrderDraftItem } from './defaults';
import {
	canPersistPurchaseOrderDraft,
	getPurchaseOrderReviewStatus,
	isDraftItemUserEditingLocked,
	validateCreditTerms
} from './validation';

describe('getPurchaseOrderReviewStatus', () => {
	it('counts reviewed and pending draft items', () => {
		const first = createEmptyPurchaseOrderDraftItem();
		const second = createEmptyPurchaseOrderDraftItem();
		first.isReviewed = true;

		expect(getPurchaseOrderReviewStatus([first, second])).toEqual({
			totalCount: 2,
			reviewedCount: 1,
			pendingCount: 1,
			allReviewed: false
		});

		second.isReviewed = true;

		expect(getPurchaseOrderReviewStatus([first, second]).allReviewed).toBe(true);
	});
});

describe('isDraftItemUserEditingLocked', () => {
	it('locks manual row editing only when the line is reviewed', () => {
		const item = createEmptyPurchaseOrderDraftItem();

		expect(isDraftItemUserEditingLocked(item)).toBe(false);

		item.isReviewed = true;
		expect(isDraftItemUserEditingLocked(item)).toBe(true);

		item.unitPurchasePrice = 19.5;
		expect(isDraftItemUserEditingLocked(item)).toBe(true);
	});
});

describe('canPersistPurchaseOrderDraft', () => {
	it('validates whether a draft can be persisted', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.productId = 'product-1';
		item.unitPurchasePrice = 0;
		item.unitSalePrice = 0;

		expect(
			canPersistPurchaseOrderDraft(
				{
					supplierId: 'supplier-1',
					orderDate: '2025-01-15',
					bcvRate: 65,
					notes: 'Compra de prueba'
				},
				[item]
			)
		).toBe(true);
	});
});

describe('validateCreditTerms', () => {
	it('validates simple credit terms with due date and pronto pago window', () => {
		const result = validateCreditTerms(PurchasePaymentTerms.CREDIT, '2026-07-10', 5, '2026-06-30');

		expect(result.isValid).toBe(true);
		expect(result.issues).toEqual([]);
	});

	it('rejects credit terms without a due date', () => {
		const result = validateCreditTerms(PurchasePaymentTerms.CREDIT, null, null, null);

		expect(result.isValid).toBe(false);
		expect(result.issues).toContain(
			'Debes indicar una fecha de vencimiento válida para el crédito'
		);
	});

	it('rejects pronto pago deadline after the credit due date', () => {
		const result = validateCreditTerms(PurchasePaymentTerms.CREDIT, '2026-07-10', 5, '2026-07-15');

		expect(result.isValid).toBe(false);
		expect(result.issues).toContain(
			'La fecha de pronto pago no puede ser posterior al vencimiento'
		);
	});
});
