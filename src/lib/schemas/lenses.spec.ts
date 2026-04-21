import { describe, it, expect } from 'vitest';
import {
	CreateLensMaterialSchema,
	UpdateLensMaterialSchema,
	OpticalRangeSchema,
	CreateLensCatalogItemSchema,
	UpdateLensCatalogItemSchema,
	LensIdSchema,
	ListLensCatalogSchema,
	LensSupplierIdSchema
} from '$lib/schemas/lenses';
import {
	LensType,
	LensCatalogSource,
	LensPriceType,
	LensInventoryMode
} from '$lib/shared/enums';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeMaterial(overrides: Record<string, unknown> = {}) {
	return {
		name: 'CR-39',
		code: 'CR39',
		refractiveIndex: 1.5,
		description: 'Standard plastic',
		...overrides
	};
}

function makeRange(overrides: Record<string, unknown> = {}) {
	return {
		sphereMin: -6,
		sphereMax: 6,
		...overrides
	};
}

function makeCatalogItem(overrides: Record<string, unknown> = {}) {
	return {
		supplierId: crypto.randomUUID(),
		name: 'Monofocal CR-39',
		type: LensType.MONOFOCAL,
		materialId: crypto.randomUUID(),
		ranges: JSON.stringify([makeRange()]),
		basePrice: 10,
		salePrice: 25,
		...overrides
	};
}

// ── CreateLensMaterialSchema ────────────────────────────────────────────

describe('CreateLensMaterialSchema', () => {
	it('accepts a valid material', () => {
		const result = CreateLensMaterialSchema.safeParse(makeMaterial());
		expect(result.success).toBe(true);
	});

	it('rejects empty name', () => {
		const result = CreateLensMaterialSchema.safeParse(makeMaterial({ name: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects empty code', () => {
		const result = CreateLensMaterialSchema.safeParse(makeMaterial({ code: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects code longer than 50 characters', () => {
		const result = CreateLensMaterialSchema.safeParse(makeMaterial({ code: 'X'.repeat(51) }));
		expect(result.success).toBe(false);
	});

	it('rejects refractive index below 1.0', () => {
		const result = CreateLensMaterialSchema.safeParse(makeMaterial({ refractiveIndex: 0.5 }));
		expect(result.success).toBe(false);
	});

	it('rejects refractive index above 2.0', () => {
		const result = CreateLensMaterialSchema.safeParse(makeMaterial({ refractiveIndex: 2.5 }));
		expect(result.success).toBe(false);
	});

	it('accepts boundary refractive index values', () => {
		const low = CreateLensMaterialSchema.safeParse(makeMaterial({ refractiveIndex: 1.0 }));
		const high = CreateLensMaterialSchema.safeParse(makeMaterial({ refractiveIndex: 2.0 }));
		expect(low.success).toBe(true);
		expect(high.success).toBe(true);
	});
});

// ── UpdateLensMaterialSchema ────────────────────────────────────────────

describe('UpdateLensMaterialSchema', () => {
	it('accepts a valid update with id', () => {
		const result = UpdateLensMaterialSchema.safeParse({
			id: crypto.randomUUID(),
			name: 'Updated'
		});
		expect(result.success).toBe(true);
	});

	it('accepts isActive field', () => {
		const result = UpdateLensMaterialSchema.safeParse({
			id: crypto.randomUUID(),
			isActive: false
		});
		expect(result.success).toBe(true);
	});

	it('rejects missing id', () => {
		const result = UpdateLensMaterialSchema.safeParse({ name: 'Test' });
		expect(result.success).toBe(false);
	});
});

// ── OpticalRangeSchema ──────────────────────────────────────────────────

describe('OpticalRangeSchema', () => {
	it('accepts a valid range', () => {
		const result = OpticalRangeSchema.safeParse(makeRange());
		expect(result.success).toBe(true);
	});

	it('rejects sphereMin > sphereMax', () => {
		const result = OpticalRangeSchema.safeParse(makeRange({ sphereMin: 6, sphereMax: -6 }));
		expect(result.success).toBe(false);
	});

	it('accepts equal sphere values', () => {
		const result = OpticalRangeSchema.safeParse(makeRange({ sphereMin: 0, sphereMax: 0 }));
		expect(result.success).toBe(true);
	});

	it('rejects cylinderMin > cylinderMax', () => {
		const result = OpticalRangeSchema.safeParse(
			makeRange({ cylinderMin: -1, cylinderMax: -4 })
		);
		expect(result.success).toBe(false);
	});

	it('accepts valid cylinder range', () => {
		const result = OpticalRangeSchema.safeParse(
			makeRange({ cylinderMin: -4, cylinderMax: -1 })
		);
		expect(result.success).toBe(true);
	});

	it('rejects cylinderMin without cylinderMax', () => {
		const result = OpticalRangeSchema.safeParse(makeRange({ cylinderMin: -2 }));
		expect(result.success).toBe(false);
	});

	it('rejects additionMin > additionMax', () => {
		const result = OpticalRangeSchema.safeParse(
			makeRange({ additionMin: 3, additionMax: 1 })
		);
		expect(result.success).toBe(false);
	});

	it('accepts valid addition range', () => {
		const result = OpticalRangeSchema.safeParse(
			makeRange({ additionMin: 1, additionMax: 3 })
		);
		expect(result.success).toBe(true);
	});

	it('rejects additionMax without additionMin', () => {
		const result = OpticalRangeSchema.safeParse(makeRange({ additionMax: 2 }));
		expect(result.success).toBe(false);
	});
});

// ── CreateLensCatalogItemSchema ─────────────────────────────────────────

describe('CreateLensCatalogItemSchema', () => {
	it('accepts a valid catalog item', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem());
		expect(result.success).toBe(true);
	});

	it('defaults source to LAB', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.source).toBe(LensCatalogSource.LAB);
		}
	});

	it('defaults boolean fields to false', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.hasAr).toBe(false);
			expect(result.data.hasBluecut).toBe(false);
			expect(result.data.isPhotochromic).toBe(false);
		}
	});

	it('defaults priceType to UNIT', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.priceType).toBe(LensPriceType.UNIT);
		}
	});

	it('defaults inventoryMode to ON_DEMAND', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.inventoryMode).toBe(LensInventoryMode.ON_DEMAND);
		}
	});

	it('rejects FINISHED source without ranges', () => {
		const result = CreateLensCatalogItemSchema.safeParse(
			makeCatalogItem({ source: LensCatalogSource.FINISHED, ranges: '[]' })
		);
		expect(result.success).toBe(false);
	});

	it('accepts FINISHED source with ranges', () => {
		const result = CreateLensCatalogItemSchema.safeParse(
			makeCatalogItem({ source: LensCatalogSource.FINISHED })
		);
		expect(result.success).toBe(true);
	});

	it('accepts LAB source without ranges', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem({ ranges: '[]' }));
		expect(result.success).toBe(true);
	});

	it('rejects negative basePrice', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem({ basePrice: -1 }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid lens type', () => {
		const result = CreateLensCatalogItemSchema.safeParse(makeCatalogItem({ type: 'INVALID' }));
		expect(result.success).toBe(false);
	});

	it('coerces string booleans', () => {
		const result = CreateLensCatalogItemSchema.safeParse(
			makeCatalogItem({ hasAr: 'true', hasBluecut: 'false' })
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.hasAr).toBe(true);
			expect(result.data.hasBluecut).toBe(false);
		}
	});

	it('coerces string prices to numbers', () => {
		const result = CreateLensCatalogItemSchema.safeParse(
			makeCatalogItem({ basePrice: '15.5', salePrice: '30' })
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.basePrice).toBe(15.5);
			expect(result.data.salePrice).toBe(30);
		}
	});

	it('accepts pending_ supplierId for inline creation', () => {
		const result = CreateLensCatalogItemSchema.safeParse(
			makeCatalogItem({ supplierId: 'pending_new-supplier' })
		);
		expect(result.success).toBe(true);
	});

	it('accepts pending_material_ materialId for inline creation', () => {
		const result = CreateLensCatalogItemSchema.safeParse(
			makeCatalogItem({ materialId: 'pending_material_new' })
		);
		expect(result.success).toBe(true);
	});
});

// ── UpdateLensCatalogItemSchema ─────────────────────────────────────────

describe('UpdateLensCatalogItemSchema', () => {
	it('accepts a valid update with id', () => {
		const result = UpdateLensCatalogItemSchema.safeParse({
			id: crypto.randomUUID(),
			name: 'Updated Lens'
		});
		expect(result.success).toBe(true);
	});

	it('accepts isActive as coerced boolean', () => {
		const result = UpdateLensCatalogItemSchema.safeParse({
			id: crypto.randomUUID(),
			isActive: 'false'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isActive).toBe(false);
		}
	});

	it('rejects missing id', () => {
		const result = UpdateLensCatalogItemSchema.safeParse({ name: 'Test' });
		expect(result.success).toBe(false);
	});
});

// ── LensIdSchema ────────────────────────────────────────────────────────

describe('LensIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = LensIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = LensIdSchema.safeParse({ id: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── ListLensCatalogSchema ───────────────────────────────────────────────

describe('ListLensCatalogSchema', () => {
	it('accepts empty object (all optional)', () => {
		const result = ListLensCatalogSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it('accepts search and filter fields', () => {
		const result = ListLensCatalogSchema.safeParse({
			search: 'mono',
			source: LensCatalogSource.LAB,
			type: LensType.PROGRESSIVE,
			supplierId: crypto.randomUUID(),
			materialId: crypto.randomUUID()
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid source enum', () => {
		const result = ListLensCatalogSchema.safeParse({ source: 'INVALID' });
		expect(result.success).toBe(false);
	});

	it('rejects invalid type enum', () => {
		const result = ListLensCatalogSchema.safeParse({ type: 'INVALID' });
		expect(result.success).toBe(false);
	});
});

// ── LensSupplierIdSchema ────────────────────────────────────────────────

describe('LensSupplierIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = LensSupplierIdSchema.safeParse({ supplierId: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = LensSupplierIdSchema.safeParse({ supplierId: 'bad' });
		expect(result.success).toBe(false);
	});

	it('rejects missing supplierId', () => {
		const result = LensSupplierIdSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
