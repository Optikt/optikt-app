import { describe, it, expect } from 'vitest';
import {
	ListSuppliersSchema,
	CreateSupplierSchema,
	UpdateSupplierSchema,
	SupplierIdSchema,
	ReactivateSupplierSchema,
	SupplierTreatmentQuerySchema,
	CreateSupplierTreatmentSchema,
	UpdateSupplierTreatmentSchema,
	SupplierTreatmentIdSchema,
	QuickCreateSupplierSchema
} from '$lib/schemas/suppliers';
import { SupplierType, CurrencyCode } from '$lib/shared/enums';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeSupplier(overrides: Record<string, unknown> = {}) {
	return {
		name: 'LensLab VE',
		type: SupplierType.LABORATORY,
		primaryPhone: '+584121234567',
		email: 'lab@example.com',
		instagram: '@lenslab',
		whatsapp: '+584121234567',
		website: 'https://lenslab.com',
		...overrides
	};
}

function makeTreatment(overrides: Record<string, unknown> = {}) {
	return {
		supplierId: crypto.randomUUID(),
		name: 'Anti-reflective',
		category: 'AR',
		price: 15,
		...overrides
	};
}

// ── ListSuppliersSchema ─────────────────────────────────────────────────

describe('ListSuppliersSchema', () => {
	it('applies pagination defaults', () => {
		const result = ListSuppliersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.perPage).toBe(10);
			expect(result.data.includeDeleted).toBe(false);
		}
	});

	it('accepts type filter', () => {
		const result = ListSuppliersSchema.safeParse({ type: SupplierType.DISTRIBUTOR });
		expect(result.success).toBe(true);
	});

	it('rejects invalid type', () => {
		const result = ListSuppliersSchema.safeParse({ type: 'INVALID' });
		expect(result.success).toBe(false);
	});
});

// ── CreateSupplierSchema ────────────────────────────────────────────────

describe('CreateSupplierSchema', () => {
	it('accepts a valid supplier', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier());
		expect(result.success).toBe(true);
	});

	it('rejects empty name', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ name: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid type', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ type: 'FAKE' }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid phone', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ primaryPhone: '123' }));
		expect(result.success).toBe(false);
	});

	it('accepts empty email', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ email: '' }));
		expect(result.success).toBe(true);
	});

	it('rejects invalid email', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ email: 'not-email' }));
		expect(result.success).toBe(false);
	});

	it('accepts valid instagram handle', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ instagram: '@optica_ve' }));
		expect(result.success).toBe(true);
	});

	it('rejects instagram without @', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ instagram: 'optica_ve' }));
		expect(result.success).toBe(false);
	});

	it('accepts empty instagram', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ instagram: '' }));
		expect(result.success).toBe(true);
	});

	it('accepts empty website (optional URL)', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ website: '' }));
		expect(result.success).toBe(true);
	});

	it('rejects invalid website URL', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ website: 'not-a-url' }));
		expect(result.success).toBe(false);
	});

	it('accepts all supplier types', () => {
		for (const type of Object.values(SupplierType)) {
			const result = CreateSupplierSchema.safeParse(makeSupplier({ type }));
			expect(result.success).toBe(true);
		}
	});

	it('accepts optional defaultCurrency', () => {
		const result = CreateSupplierSchema.safeParse(
			makeSupplier({ defaultCurrency: CurrencyCode.USD_BCV })
		);
		expect(result.success).toBe(true);
	});

	it('rejects invalid defaultCurrency', () => {
		const result = CreateSupplierSchema.safeParse(makeSupplier({ defaultCurrency: 'FAKE' }));
		expect(result.success).toBe(false);
	});
});

// ── UpdateSupplierSchema ────────────────────────────────────────────────

describe('UpdateSupplierSchema', () => {
	it('accepts a valid update with id', () => {
		const result = UpdateSupplierSchema.safeParse({
			id: crypto.randomUUID(),
			name: 'Updated'
		});
		expect(result.success).toBe(true);
	});

	it('requires a valid UUID for id', () => {
		const result = UpdateSupplierSchema.safeParse({ id: 'bad' });
		expect(result.success).toBe(false);
	});

	it('accepts update with only id (all fields optional)', () => {
		const result = UpdateSupplierSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});
});

// ── SupplierIdSchema ────────────────────────────────────────────────────

describe('SupplierIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = SupplierIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = SupplierIdSchema.safeParse({ id: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── ReactivateSupplierSchema ────────────────────────────────────────────

describe('ReactivateSupplierSchema', () => {
	it('accepts a valid UUID for deletedSupplierId', () => {
		const result = ReactivateSupplierSchema.safeParse({
			deletedSupplierId: crypto.randomUUID()
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing deletedSupplierId', () => {
		const result = ReactivateSupplierSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});

// ── SupplierTreatmentQuerySchema ────────────────────────────────────────

describe('SupplierTreatmentQuerySchema', () => {
	it('accepts a valid UUID', () => {
		const result = SupplierTreatmentQuerySchema.safeParse({ supplierId: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = SupplierTreatmentQuerySchema.safeParse({ supplierId: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── CreateSupplierTreatmentSchema ───────────────────────────────────────

describe('CreateSupplierTreatmentSchema', () => {
	it('accepts a valid treatment', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment());
		expect(result.success).toBe(true);
	});

	it('defaults isTaxable to true', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isTaxable).toBe(true);
		}
	});

	it('defaults taxRate to 16', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.taxRate).toBe(16);
		}
	});

	it('rejects empty name', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment({ name: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects name exceeding 100 characters', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(
			makeTreatment({ name: 'X'.repeat(101) })
		);
		expect(result.success).toBe(false);
	});

	it('rejects invalid category', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(
			makeTreatment({ category: 'INVALID' })
		);
		expect(result.success).toBe(false);
	});

	it('rejects negative price', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment({ price: -1 }));
		expect(result.success).toBe(false);
	});

	it('coerces string price to number', () => {
		const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment({ price: '20.5' }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.price).toBe(20.5);
		}
	});

	it('accepts valid categories', () => {
		for (const category of ['AR', 'BLUECUT']) {
			const result = CreateSupplierTreatmentSchema.safeParse(makeTreatment({ category }));
			expect(result.success).toBe(true);
		}
	});
});

// ── UpdateSupplierTreatmentSchema ───────────────────────────────────────

describe('UpdateSupplierTreatmentSchema', () => {
	it('accepts a valid update with id', () => {
		const result = UpdateSupplierTreatmentSchema.safeParse({
			id: crypto.randomUUID(),
			name: 'Updated Treatment'
		});
		expect(result.success).toBe(true);
	});

	it('accepts isActive coerced boolean', () => {
		const result = UpdateSupplierTreatmentSchema.safeParse({
			id: crypto.randomUUID(),
			isActive: 'true'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isActive).toBe(true);
		}
	});

	it('rejects missing id', () => {
		const result = UpdateSupplierTreatmentSchema.safeParse({ name: 'Test' });
		expect(result.success).toBe(false);
	});
});

// ── SupplierTreatmentIdSchema ───────────────────────────────────────────

describe('SupplierTreatmentIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = SupplierTreatmentIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = SupplierTreatmentIdSchema.safeParse({ id: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── QuickCreateSupplierSchema ───────────────────────────────────────────

describe('QuickCreateSupplierSchema', () => {
	it('accepts just a name', () => {
		const result = QuickCreateSupplierSchema.safeParse({ name: 'Quick Supplier' });
		expect(result.success).toBe(true);
	});

	it('accepts name with optional type and phone', () => {
		const result = QuickCreateSupplierSchema.safeParse({
			name: 'Quick Supplier',
			type: SupplierType.DISTRIBUTOR,
			primaryPhone: '+584121234567'
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty name', () => {
		const result = QuickCreateSupplierSchema.safeParse({ name: '' });
		expect(result.success).toBe(false);
	});
});
