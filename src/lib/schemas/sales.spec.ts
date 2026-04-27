import { describe, it, expect } from 'vitest';
import { SaleItemSchema, CreateSaleSchema, CancelSaleSchema } from '$lib/schemas/sales';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { DiscountType, RefundStatus } from '$lib/shared/enums';

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

// ── CancelSaleSchema ────────────────────────────────────────────────────

describe('CancelSaleSchema', () => {
	const validBase = {
		id: crypto.randomUUID(),
		reason: 'Solicitud del cliente por error',
		refundStatus: RefundStatus.NO_PAYMENT
	};

	it('accepts a valid cancellation with reason >= 10 chars', () => {
		const result = CancelSaleSchema.safeParse(validBase);
		expect(result.success).toBe(true);
	});

	it('rejects when reason is missing', () => {
		const result = CancelSaleSchema.safeParse({
			id: crypto.randomUUID(),
			refundStatus: RefundStatus.NO_PAYMENT
		});
		expect(result.success).toBe(false);
	});

	it('rejects when reason is too short (< 10 chars)', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			reason: 'corto'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const reasonError = result.error.issues.find((i) => i.path.includes('reason'));
			expect(reasonError?.message).toBe('El motivo debe tener al menos 10 caracteres');
		}
	});

	it('rejects when reason is empty string', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			reason: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects when id is invalid', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			id: 'not-a-uuid'
		});
		expect(result.success).toBe(false);
	});

	it('accepts exactly 10 characters', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			reason: '1234567890'
		});
		expect(result.success).toBe(true);
	});

	it('rejects when refundStatus is missing', () => {
		const result = CancelSaleSchema.safeParse({
			id: crypto.randomUUID(),
			reason: 'Solicitud del cliente por error'
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid refundStatus', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			refundStatus: 'INVALID'
		});
		expect(result.success).toBe(false);
	});

	// ── Refund validation (REFUNDED) ──────────────────────────────────

	it('accepts REFUNDED with valid notes', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			refundStatus: RefundStatus.REFUNDED,
			refundNotes: 'Reembolso completo al cliente'
		});
		expect(result.success).toBe(true);
	});

	it('rejects REFUNDED without refundNotes', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			refundStatus: RefundStatus.REFUNDED
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const notesError = result.error.issues.find((i) => i.path.includes('refundNotes'));
			expect(notesError).toBeDefined();
		}
	});

	it('rejects REFUNDED with refundNotes too short', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			refundStatus: RefundStatus.REFUNDED,
			refundNotes: 'corto'
		});
		expect(result.success).toBe(false);
	});

	// ── Refund validation (RETAINED) ──────────────────────────────────

	it('accepts RETAINED with valid notes', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			refundStatus: RefundStatus.RETAINED,
			refundNotes: 'Cliente acepta retener como depósito'
		});
		expect(result.success).toBe(true);
	});

	it('rejects RETAINED without refundNotes', () => {
		const result = CancelSaleSchema.safeParse({
			...validBase,
			refundStatus: RefundStatus.RETAINED
		});
		expect(result.success).toBe(false);
	});

	// ── NO_PAYMENT (no refund details needed) ─────────────────────────

	it('accepts NO_PAYMENT without refundAmount/refundNotes', () => {
		const result = CancelSaleSchema.safeParse({
			id: crypto.randomUUID(),
			reason: 'Venta sin pagos registrados',
			refundStatus: RefundStatus.NO_PAYMENT
		});
		expect(result.success).toBe(true);
	});

	it('accepts NO_PAYMENT even with extra refundAmount/refundNotes', () => {
		const result = CancelSaleSchema.safeParse({
			id: crypto.randomUUID(),
			reason: 'Venta sin pagos registrados',
			refundStatus: RefundStatus.NO_PAYMENT,
			refundAmount: 0,
			refundNotes: ''
		});
		expect(result.success).toBe(true);
	});
});

// ── FREE_ITEM schema tests ───────────────────────────────────────────────

function makeFreeItem(overrides: Record<string, unknown> = {}) {
	return {
		itemType: SaleItemType.FREE_ITEM,
		quantity: 1,
		unitPrice: 45,
		discount: 0,
		discountType: DiscountType.FIXED,
		freeItemCategory: 'CONTACT_LENS_FORMULA',
		freeItemDescription: 'LC Novak -2.50 miel',
		...overrides
	};
}

describe('SaleItemSchema — FREE_ITEM', () => {
	it('accepts a valid FREE_ITEM with required fields', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem());
		expect(result.success).toBe(true);
	});

	it('accepts FREE_ITEM with optional cost', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemUnitCost: 18 }));
		expect(result.success).toBe(true);
	});

	it('accepts FREE_ITEM with optional optical notes', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemOpticalNotes: 'OD -2.50 sph' }));
		expect(result.success).toBe(true);
	});

	it('accepts FREE_ITEM without optional cost (cost can be filled later)', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.freeItemUnitCost).toBeUndefined();
		}
	});

	it('rejects FREE_ITEM with description shorter than 3 chars', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemDescription: 'ab' }));
		expect(result.success).toBe(false);
	});

	it('rejects FREE_ITEM with description longer than 500 chars', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemDescription: 'a'.repeat(501) }));
		expect(result.success).toBe(false);
	});

	it('rejects FREE_ITEM with invalid category', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemCategory: 'INVALID_CAT' }));
		expect(result.success).toBe(false);
	});

	it('rejects FREE_ITEM with unitPrice of 0', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ unitPrice: 0 }));
		expect(result.success).toBe(false);
	});

	it('rejects FREE_ITEM with negative unit cost', () => {
		const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemUnitCost: -5 }));
		expect(result.success).toBe(false);
	});

	it('rejects FREE_ITEM (non-SERVICE) with zero unit cost', () => {
		const result = SaleItemSchema.safeParse(
			makeFreeItem({ freeItemCategory: 'CONTACT_LENS_FORMULA', freeItemUnitCost: 0 })
		);
		expect(result.success).toBe(false);
	});

	it('accepts FREE_ITEM SERVICE with zero unit cost', () => {
		const result = SaleItemSchema.safeParse(
			makeFreeItem({ freeItemCategory: 'SERVICE', freeItemUnitCost: 0 })
		);
		expect(result.success).toBe(true);
	});

	it('accepts all valid FREE_ITEM category values', () => {
		const categories = [
			'CONTACT_LENS_FORMULA',
			'CONTACT_LENS_COSMETIC',
			'INTRAOCULAR_LENS',
			'SERVICE',
			'OTHER'
		];
		for (const category of categories) {
			const result = SaleItemSchema.safeParse(makeFreeItem({ freeItemCategory: category }));
			expect(result.success).toBe(true);
		}
	});
});

describe('EnrichFreeItemSchema', () => {
	it('imports from schemas correctly', async () => {
		const { EnrichFreeItemSchema } = await import('$lib/schemas/sales');
		expect(EnrichFreeItemSchema).toBeDefined();
	});

	it('accepts valid enrichment data', async () => {
		const { EnrichFreeItemSchema } = await import('$lib/schemas/sales');
		const result = EnrichFreeItemSchema.safeParse({
			saleItemId: crypto.randomUUID(),
			category: 'CONTACT_LENS_FORMULA',
			unitCost: 18.5
		});
		expect(result.success).toBe(true);
	});

	it('rejects enrichment with zero cost for non-SERVICE category', async () => {
		const { EnrichFreeItemSchema } = await import('$lib/schemas/sales');
		const result = EnrichFreeItemSchema.safeParse({
			saleItemId: crypto.randomUUID(),
			category: 'CONTACT_LENS_FORMULA',
			unitCost: 0
		});
		expect(result.success).toBe(false);
	});

	it('accepts enrichment with zero cost for SERVICE category', async () => {
		const { EnrichFreeItemSchema } = await import('$lib/schemas/sales');
		const result = EnrichFreeItemSchema.safeParse({
			saleItemId: crypto.randomUUID(),
			category: 'SERVICE',
			unitCost: 0
		});
		expect(result.success).toBe(true);
	});

	it('rejects enrichment with negative cost', async () => {
		const { EnrichFreeItemSchema } = await import('$lib/schemas/sales');
		const result = EnrichFreeItemSchema.safeParse({
			saleItemId: crypto.randomUUID(),
			category: 'CONTACT_LENS_FORMULA',
			unitCost: -5
		});
		expect(result.success).toBe(false);
	});

	it('accepts optional optical notes', async () => {
		const { EnrichFreeItemSchema } = await import('$lib/schemas/sales');
		const result = EnrichFreeItemSchema.safeParse({
			saleItemId: crypto.randomUUID(),
			category: 'CONTACT_LENS_FORMULA',
			unitCost: 20,
			opticalNotes: 'OD -3.00 sph, color verde'
		});
		expect(result.success).toBe(true);
	});
});
