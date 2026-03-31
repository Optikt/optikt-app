import { describe, it, expect } from 'vitest';
import {
	QuoteItemSchema,
	CreateQuoteSchema,
	UpdateQuoteSchema,
	ListQuotesSchema,
	AssignQuoteCustomerSchema
} from '$lib/schemas/quotes';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { DiscountType } from '$lib/shared/enums';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeProductItem(overrides: Record<string, unknown> = {}) {
	return {
		itemType: SaleItemType.PRODUCT,
		productId: crypto.randomUUID(),
		quantity: 1,
		unitPrice: 50,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	};
}

function makeLensPairItem(overrides: Record<string, unknown> = {}) {
	return {
		id: crypto.randomUUID(),
		itemType: SaleItemType.LENS_PAIR,
		lensCatalogItemId: crypto.randomUUID(),
		quantity: 1,
		unitPrice: 30,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	};
}

function makeTreatmentItem(parentQuoteItemId: string, overrides: Record<string, unknown> = {}) {
	return {
		itemType: SaleItemType.TREATMENT,
		parentQuoteItemId,
		supplierTreatmentId: crypto.randomUUID(),
		quantity: 1,
		unitPrice: 15,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	};
}

// ── QuoteItemSchema ─────────────────────────────────────────────────────

describe('QuoteItemSchema', () => {
	it('accepts a valid PRODUCT item', () => {
		const result = QuoteItemSchema.safeParse(makeProductItem());
		expect(result.success).toBe(true);
	});

	it('accepts a valid LENS_PAIR item with client-generated id', () => {
		const result = QuoteItemSchema.safeParse(makeLensPairItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBeDefined();
		}
	});

	it('accepts a valid TREATMENT item with parentQuoteItemId', () => {
		const parentId = crypto.randomUUID();
		const result = QuoteItemSchema.safeParse(makeTreatmentItem(parentId));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.parentQuoteItemId).toBe(parentId);
			expect(result.data.supplierTreatmentId).toBeDefined();
		}
	});

	it('rejects item with invalid itemType', () => {
		const result = QuoteItemSchema.safeParse(makeProductItem({ itemType: 'INVALID' }));
		expect(result.success).toBe(false);
	});

	it('rejects item with negative unitPrice', () => {
		const result = QuoteItemSchema.safeParse(makeProductItem({ unitPrice: -1 }));
		expect(result.success).toBe(false);
	});

	it('rejects item with quantity < 1', () => {
		const result = QuoteItemSchema.safeParse(makeProductItem({ quantity: 0 }));
		expect(result.success).toBe(false);
	});

	it('defaults discount to 0 when omitted', () => {
		const { discount: _, ...item } = makeProductItem();
		const result = QuoteItemSchema.safeParse(item);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.discount).toBe(0);
		}
	});

	it('accepts optional prescription snapshot fields', () => {
		const result = QuoteItemSchema.safeParse(
			makeLensPairItem({
				odSphere: -2.5,
				odCylinder: -1.0,
				odAxis: 90,
				odAddition: 1.5
			})
		);
		expect(result.success).toBe(true);
	});
});

// ── CreateQuoteSchema ───────────────────────────────────────────────────

describe('CreateQuoteSchema', () => {
	const validBase = {
		quoteDate: '2025-01-15',
		discount: 0,
		discountType: DiscountType.FIXED
	};

	it('accepts a quote with product items only (no customer)', () => {
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a quote with a customer', () => {
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			customerId: crypto.randomUUID(),
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a quote with lens + treatment items', () => {
		const lensItem = makeLensPairItem();
		const treatment = makeTreatmentItem(lensItem.id!);
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			items: [lensItem, treatment]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a quote with validUntil date', () => {
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			validUntil: '2025-02-15',
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.validUntil).toBe('2025-02-15');
		}
	});

	it('rejects a quote with no items', () => {
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			items: []
		});
		expect(result.success).toBe(false);
	});

	it('does NOT require a customer (unlike sales)', () => {
		const result = CreateQuoteSchema.safeParse({
			quoteDate: '2025-01-15',
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a quote with newCustomer instead of customerId', () => {
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			newCustomer: { firstName: 'Ana', lastName: 'Pérez', idNumber: 'V-12345678' },
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('accepts mixed product, lens, and treatment items', () => {
		const lensItem = makeLensPairItem();
		const result = CreateQuoteSchema.safeParse({
			...validBase,
			items: [makeProductItem(), lensItem, makeTreatmentItem(lensItem.id!)]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.items).toHaveLength(3);
		}
	});
});

// ── UpdateQuoteSchema ───────────────────────────────────────────────────

describe('UpdateQuoteSchema', () => {
	it('accepts update with id and items', () => {
		const result = UpdateQuoteSchema.safeParse({
			id: crypto.randomUUID(),
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('accepts update with optional fields', () => {
		const result = UpdateQuoteSchema.safeParse({
			id: crypto.randomUUID(),
			customerId: crypto.randomUUID(),
			discount: 10,
			discountType: DiscountType.PERCENTAGE,
			validUntil: '2025-03-01',
			notes: 'Updated notes',
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('rejects update without items', () => {
		const result = UpdateQuoteSchema.safeParse({
			id: crypto.randomUUID(),
			items: []
		});
		expect(result.success).toBe(false);
	});

	it('rejects update without id', () => {
		const result = UpdateQuoteSchema.safeParse({
			items: [makeProductItem()]
		});
		expect(result.success).toBe(false);
	});

	it('allows nullable customerId', () => {
		const result = UpdateQuoteSchema.safeParse({
			id: crypto.randomUUID(),
			customerId: null,
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});
});

// ── AssignQuoteCustomerSchema ────────────────────────────────────────────

describe('AssignQuoteCustomerSchema', () => {
	it('accepts with existing customerId', () => {
		const result = AssignQuoteCustomerSchema.safeParse({
			id: crypto.randomUUID(),
			customerId: crypto.randomUUID()
		});
		expect(result.success).toBe(true);
	});

	it('accepts with newCustomer data', () => {
		const result = AssignQuoteCustomerSchema.safeParse({
			id: crypto.randomUUID(),
			newCustomer: { firstName: 'Ana', lastName: 'Pérez', idNumber: 'V-12345678' }
		});
		expect(result.success).toBe(true);
	});

	it('rejects when neither customerId nor newCustomer provided', () => {
		const result = AssignQuoteCustomerSchema.safeParse({
			id: crypto.randomUUID()
		});
		expect(result.success).toBe(false);
	});

	it('rejects without id', () => {
		const result = AssignQuoteCustomerSchema.safeParse({
			customerId: crypto.randomUUID()
		});
		expect(result.success).toBe(false);
	});
});

// ── ListQuotesSchema ────────────────────────────────────────────────────

describe('ListQuotesSchema', () => {
	it('accepts default pagination', () => {
		const result = ListQuotesSchema.safeParse({ page: 1, perPage: 10 });
		expect(result.success).toBe(true);
	});

	it('accepts status filter', () => {
		const result = ListQuotesSchema.safeParse({
			page: 1,
			perPage: 10,
			status: QuoteStatus.DRAFT
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid status', () => {
		const result = ListQuotesSchema.safeParse({
			page: 1,
			perPage: 10,
			status: 'INVALID_STATUS'
		});
		expect(result.success).toBe(false);
	});

	it('accepts date range filters', () => {
		const result = ListQuotesSchema.safeParse({
			page: 1,
			perPage: 10,
			dateFrom: '2025-01-01',
			dateTo: '2025-12-31'
		});
		expect(result.success).toBe(true);
	});
});
