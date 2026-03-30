import { describe, it, expect } from 'vitest';
import { SaleItemSchema, CreateSaleSchema } from '$lib/schemas/sales';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { DiscountType } from '$lib/shared/enums';

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

function makeTreatmentItem(parentSaleItemId: string, overrides: Record<string, unknown> = {}) {
	return {
		itemType: SaleItemType.TREATMENT,
		parentSaleItemId,
		supplierTreatmentId: crypto.randomUUID(),
		quantity: 1,
		unitPrice: 15,
		discount: 0,
		discountType: DiscountType.FIXED,
		...overrides
	};
}

// ── SaleItemSchema ──────────────────────────────────────────────────────

describe('SaleItemSchema', () => {
	it('accepts a valid PRODUCT item', () => {
		const result = SaleItemSchema.safeParse(makeProductItem());
		expect(result.success).toBe(true);
	});

	it('accepts a valid LENS_PAIR item with client-generated id', () => {
		const result = SaleItemSchema.safeParse(makeLensPairItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBeDefined();
		}
	});

	it('accepts a valid TREATMENT item', () => {
		const parentId = crypto.randomUUID();
		const result = SaleItemSchema.safeParse(makeTreatmentItem(parentId));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.parentSaleItemId).toBe(parentId);
			expect(result.data.supplierTreatmentId).toBeDefined();
		}
	});

	it('rejects item with invalid itemType', () => {
		const result = SaleItemSchema.safeParse(makeProductItem({ itemType: 'INVALID' }));
		expect(result.success).toBe(false);
	});

	it('rejects item with negative unitPrice', () => {
		const result = SaleItemSchema.safeParse(makeProductItem({ unitPrice: -1 }));
		expect(result.success).toBe(false);
	});

	it('rejects item with quantity < 1', () => {
		const result = SaleItemSchema.safeParse(makeProductItem({ quantity: 0 }));
		expect(result.success).toBe(false);
	});

	it('accepts optional id field for client-generated UUIDs', () => {
		const id = crypto.randomUUID();
		const result = SaleItemSchema.safeParse(makeProductItem({ id }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe(id);
		}
	});

	it('defaults discount to 0 when omitted', () => {
		const { discount: _, ...item } = makeProductItem();
		const result = SaleItemSchema.safeParse(item);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.discount).toBe(0);
		}
	});
});

// ── CreateSaleSchema ────────────────────────────────────────────────────

describe('CreateSaleSchema', () => {
	const validBase = {
		customerId: crypto.randomUUID(),
		saleDate: '2025-01-15',
		discount: 0,
		discountType: DiscountType.FIXED
	};

	it('accepts a sale with product items only', () => {
		const result = CreateSaleSchema.safeParse({
			...validBase,
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a sale with lens + treatment items', () => {
		const lensItem = makeLensPairItem();
		const treatment = makeTreatmentItem(lensItem.id!);
		const result = CreateSaleSchema.safeParse({
			...validBase,
			items: [lensItem, treatment]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a sale with multiple treatments per lens', () => {
		const lensItem = makeLensPairItem();
		const t1 = makeTreatmentItem(lensItem.id!);
		const t2 = makeTreatmentItem(lensItem.id!, { unitPrice: 8 });
		const result = CreateSaleSchema.safeParse({
			...validBase,
			items: [lensItem, t1, t2]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.items).toHaveLength(3);
		}
	});

	it('accepts a sale with products, lenses, and treatments combined', () => {
		const lensItem = makeLensPairItem();
		const result = CreateSaleSchema.safeParse({
			...validBase,
			items: [makeProductItem(), lensItem, makeTreatmentItem(lensItem.id!)]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.items).toHaveLength(3);
		}
	});

	it('rejects a sale with no items', () => {
		const result = CreateSaleSchema.safeParse({
			...validBase,
			items: []
		});
		expect(result.success).toBe(false);
	});

	it('rejects a sale with no customer', () => {
		const result = CreateSaleSchema.safeParse({
			saleDate: '2025-01-15',
			items: [makeProductItem()]
		});
		expect(result.success).toBe(false);
	});

	it('accepts a sale with inline new customer', () => {
		const result = CreateSaleSchema.safeParse({
			newCustomer: {
				firstName: 'Juan',
				lastName: 'Pérez',
				idNumber: 'V-87654321'
			},
			saleDate: '2025-01-15',
			items: [makeProductItem()]
		});
		expect(result.success).toBe(true);
	});
});
