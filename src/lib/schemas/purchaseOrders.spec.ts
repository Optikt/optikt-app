import { describe, it, expect } from 'vitest';
import {
	CreatePurchaseOrderSchema,
	UpdatePurchaseOrderSchema,
	PurchaseOrderItemSchema,
	PurchaseOrderDraftItemSchema,
	SavePurchaseOrderDraftSchema,
	ConfirmPurchaseOrderSchema,
	CancelPurchaseOrderSchema,
	MarkPurchaseOrderReadySchema,
	TogglePurchaseOrderItemReviewedSchema,
	ListPurchaseOrdersSchema
} from './purchaseOrders';

const validItem = {
	itemType: 'PRODUCT',
	productId: '00000000-0000-4000-8000-000000000001',
	quantity: 5,
	unitPurchasePrice: 10,
	unitSalePrice: 25,
	appliesIva: true,
	ivaRate: 16
};

const baseCreatePayload = {
	supplierId: '00000000-0000-4000-8000-000000000001',
	documentType: 'INVOICE',
	orderDate: '2025-01-15',
	bcvRate: 65.5,
	notes: 'Compra directa al proveedor',
	items: [validItem]
};

describe('PurchaseOrderItemSchema', () => {
	it('accepts a valid product item', () => {
		const result = PurchaseOrderItemSchema.safeParse(validItem);
		expect(result.success).toBe(true);
	});

	it('accepts a valid lens item', () => {
		const result = PurchaseOrderItemSchema.safeParse({
			itemType: 'LENS',
			lensCatalogItemId: '00000000-0000-4000-8000-000000000002',
			quantity: 10,
			unitPurchasePrice: 5,
			unitSalePrice: 15
		});
		expect(result.success).toBe(true);
	});

	it('rejects quantity < 1', () => {
		const result = PurchaseOrderItemSchema.safeParse({ ...validItem, quantity: 0 });
		expect(result.success).toBe(false);
	});

	it('rejects negative purchase price', () => {
		const result = PurchaseOrderItemSchema.safeParse({ ...validItem, unitPurchasePrice: -1 });
		expect(result.success).toBe(false);
	});

	it('rejects negative sale price', () => {
		const result = PurchaseOrderItemSchema.safeParse({ ...validItem, unitSalePrice: -5 });
		expect(result.success).toBe(false);
	});

	it('rejects invalid item type', () => {
		const result = PurchaseOrderItemSchema.safeParse({ ...validItem, itemType: 'INVALID' });
		expect(result.success).toBe(false);
	});

	it('defaults appliesIva to true', () => {
		const { appliesIva: _appliesIva, ...withoutIva } = validItem;
		const result = PurchaseOrderItemSchema.safeParse(withoutIva);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.appliesIva).toBe(true);
	});

	it('defaults ivaRate to 16', () => {
		const { ivaRate: _ivaRate, ...withoutRate } = validItem;
		const result = PurchaseOrderItemSchema.safeParse(withoutRate);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.ivaRate).toBe(16);
	});
});

describe('PurchaseOrderDraftItemSchema', () => {
	it('accepts an existing item id for draft edits', () => {
		const result = PurchaseOrderDraftItemSchema.safeParse({
			...validItem,
			id: '00000000-0000-4000-8000-000000000003'
		});
		expect(result.success).toBe(true);
	});

	it('accepts a new item without id for draft edits', () => {
		const result = PurchaseOrderDraftItemSchema.safeParse(validItem);
		expect(result.success).toBe(true);
	});

	it('accepts an optional isReviewed flag', () => {
		const result = PurchaseOrderDraftItemSchema.safeParse({
			...validItem,
			isReviewed: true
		});
		expect(result.success).toBe(true);
	});

	it('rejects a non-boolean isReviewed value', () => {
		const result = PurchaseOrderDraftItemSchema.safeParse({
			...validItem,
			isReviewed: 'yes'
		});
		expect(result.success).toBe(false);
	});
});

describe('CreatePurchaseOrderSchema', () => {
	it('accepts a valid PO', () => {
		const result = CreatePurchaseOrderSchema.safeParse(baseCreatePayload);
		expect(result.success).toBe(true);
	});

	it('requires at least one item', () => {
		const result = CreatePurchaseOrderSchema.safeParse({ ...baseCreatePayload, items: [] });
		expect(result.success).toBe(false);
	});

	it('requires a supplier', () => {
		const { supplierId: _supplierId, ...rest } = baseCreatePayload;
		const result = CreatePurchaseOrderSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('requires a valid orderDate', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			orderDate: 'not-a-date'
		});
		expect(result.success).toBe(false);
	});

	it('requires non-negative bcvRate', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			bcvRate: -1
		});
		expect(result.success).toBe(false);
	});

	it('accepts optional fields', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			invoiceNumber: 'INV-001',
			deliveryNoteNumber: 'DN-001'
		});
		expect(result.success).toBe(true);
	});

	it('rejects notes shorter than 6 characters', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			notes: 'abc'
		});
		expect(result.success).toBe(false);
	});

	it('requires documentType', () => {
		const { documentType: _dt, ...rest } = baseCreatePayload;
		const result = CreatePurchaseOrderSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('accepts DELIVERY_NOTE as documentType', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			documentType: 'DELIVERY_NOTE'
		});
		expect(result.success).toBe(true);
	});

	it('rejects notes shorter than 6 characters', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			notes: 'abc'
		});
		expect(result.success).toBe(false);
	});

	it('requires documentType', () => {
		const { documentType: _dt, ...rest } = baseCreatePayload;
		const result = CreatePurchaseOrderSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('accepts DELIVERY_NOTE as documentType', () => {
		const result = CreatePurchaseOrderSchema.safeParse({
			...baseCreatePayload,
			documentType: 'DELIVERY_NOTE'
		});
		expect(result.success).toBe(true);
	});
});

describe('UpdatePurchaseOrderSchema', () => {
	it('requires an id', () => {
		const result = UpdatePurchaseOrderSchema.safeParse({
			supplierId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(false);
	});

	it('accepts partial updates', () => {
		const result = UpdatePurchaseOrderSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000001',
			notes: 'Updated notes'
		});
		expect(result.success).toBe(true);
	});
});

describe('SavePurchaseOrderDraftSchema', () => {
	it('accepts a complete editable draft payload', () => {
		const result = SavePurchaseOrderDraftSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000010',
			...baseCreatePayload,
			items: [
				{
					...validItem,
					id: '00000000-0000-4000-8000-000000000011'
				},
				{
					...validItem,
					productId: '00000000-0000-4000-8000-000000000012'
				}
			]
		});

		expect(result.success).toBe(true);
	});

	it('requires at least one editable draft item', () => {
		const result = SavePurchaseOrderDraftSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000010',
			...baseCreatePayload,
			items: []
		});

		expect(result.success).toBe(false);
	});
});

describe('ConfirmPurchaseOrderSchema', () => {
	it('requires a valid UUID', () => {
		const result = ConfirmPurchaseOrderSchema.safeParse({ id: 'not-a-uuid' });
		expect(result.success).toBe(false);
	});

	it('accepts a valid UUID', () => {
		const result = ConfirmPurchaseOrderSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});
});

describe('CancelPurchaseOrderSchema', () => {
	it('requires a valid UUID', () => {
		const result = CancelPurchaseOrderSchema.safeParse({ id: 'invalid' });
		expect(result.success).toBe(false);
	});
});

describe('MarkPurchaseOrderReadySchema', () => {
	it('requires a valid UUID', () => {
		const result = MarkPurchaseOrderReadySchema.safeParse({ id: 'invalid' });
		expect(result.success).toBe(false);
	});

	it('accepts a valid UUID', () => {
		const result = MarkPurchaseOrderReadySchema.safeParse({
			id: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});
});

describe('TogglePurchaseOrderItemReviewedSchema', () => {
	it('accepts a valid toggle payload', () => {
		const result = TogglePurchaseOrderItemReviewedSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000001',
			value: true
		});
		expect(result.success).toBe(true);
	});

	it('requires a boolean value', () => {
		const result = TogglePurchaseOrderItemReviewedSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000001',
			value: 'yes'
		});
		expect(result.success).toBe(false);
	});

	it('requires a valid UUID', () => {
		const result = TogglePurchaseOrderItemReviewedSchema.safeParse({
			id: 'not-a-uuid',
			value: true
		});
		expect(result.success).toBe(false);
	});
});

describe('ListPurchaseOrdersSchema', () => {
	it('accepts empty object (defaults)', () => {
		const result = ListPurchaseOrdersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.perPage).toBe(10);
			expect(result.data.includeDeleted).toBe(false);
		}
	});

	it('accepts status filter', () => {
		const result = ListPurchaseOrdersSchema.safeParse({ status: 'DRAFT' });
		expect(result.success).toBe(true);
	});

	it('accepts readyForReview filter', () => {
		const result = ListPurchaseOrdersSchema.safeParse({
			status: 'DRAFT',
			readyForReview: true
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid status', () => {
		const result = ListPurchaseOrdersSchema.safeParse({ status: 'INVALID' });
		expect(result.success).toBe(false);
	});

	it('accepts supplierId filter', () => {
		const result = ListPurchaseOrdersSchema.safeParse({
			supplierId: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});

	it('accepts search filter', () => {
		const result = ListPurchaseOrdersSchema.safeParse({ search: 'PO-0042' });
		expect(result.success).toBe(true);
	});
});
