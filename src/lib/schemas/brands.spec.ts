import { describe, it, expect } from 'vitest';
import {
	ListBrandsSchema,
	CreateBrandSchema,
	UpdateBrandSchema,
	BrandIdSchema,
	ReactivateBrandSchema,
	QuickCreateBrandSchema
} from '$lib/schemas/brands';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeBrand(overrides: Record<string, unknown> = {}) {
	return {
		name: 'Ray-Ban',
		description: 'Luxury eyewear brand',
		country: 'Italy',
		website: 'https://www.ray-ban.com',
		...overrides
	};
}

// ── ListBrandsSchema ────────────────────────────────────────────────────

describe('ListBrandsSchema', () => {
	it('applies defaults for page, perPage and includeDeleted', () => {
		const result = ListBrandsSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.perPage).toBe(10);
			expect(result.data.includeDeleted).toBe(false);
		}
	});

	it('accepts explicit pagination values', () => {
		const result = ListBrandsSchema.safeParse({ page: 2, perPage: 50, includeDeleted: true });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(2);
			expect(result.data.includeDeleted).toBe(true);
		}
	});

	it('rejects page less than 1', () => {
		const result = ListBrandsSchema.safeParse({ page: 0 });
		expect(result.success).toBe(false);
	});

	it('rejects perPage greater than 100', () => {
		const result = ListBrandsSchema.safeParse({ perPage: 101 });
		expect(result.success).toBe(false);
	});
});

// ── CreateBrandSchema ───────────────────────────────────────────────────

describe('CreateBrandSchema', () => {
	it('accepts a valid brand', () => {
		const result = CreateBrandSchema.safeParse(makeBrand());
		expect(result.success).toBe(true);
	});

	it('accepts a brand with only required fields', () => {
		const result = CreateBrandSchema.safeParse({ name: 'Oakley', website: '' });
		expect(result.success).toBe(true);
	});

	it('rejects empty name', () => {
		const result = CreateBrandSchema.safeParse(makeBrand({ name: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects missing name', () => {
		const { name: _, ...rest } = makeBrand();
		const result = CreateBrandSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('rejects name exceeding 100 characters', () => {
		const result = CreateBrandSchema.safeParse(makeBrand({ name: 'A'.repeat(101) }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid website URL', () => {
		const result = CreateBrandSchema.safeParse(makeBrand({ website: 'not-a-url' }));
		expect(result.success).toBe(false);
	});

	it('accepts empty string as website (optional URL)', () => {
		const result = CreateBrandSchema.safeParse(makeBrand({ website: '' }));
		expect(result.success).toBe(true);
	});
});

// ── UpdateBrandSchema ───────────────────────────────────────────────────

describe('UpdateBrandSchema', () => {
	it('accepts a valid update with id and partial fields', () => {
		const result = UpdateBrandSchema.safeParse({
			id: crypto.randomUUID(),
			name: 'Updated Brand'
		});
		expect(result.success).toBe(true);
	});

	it('requires a valid UUID for id', () => {
		const result = UpdateBrandSchema.safeParse({ id: 'not-a-uuid', name: 'Test' });
		expect(result.success).toBe(false);
	});

	it('accepts update with only id (all fields optional)', () => {
		const result = UpdateBrandSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});
});

// ── BrandIdSchema ───────────────────────────────────────────────────────

describe('BrandIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = BrandIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = BrandIdSchema.safeParse({ id: 'abc' });
		expect(result.success).toBe(false);
	});
});

// ── ReactivateBrandSchema ───────────────────────────────────────────────

describe('ReactivateBrandSchema', () => {
	it('accepts a valid UUID for deletedBrandId', () => {
		const result = ReactivateBrandSchema.safeParse({ deletedBrandId: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects missing deletedBrandId', () => {
		const result = ReactivateBrandSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects invalid UUID for deletedBrandId', () => {
		const result = ReactivateBrandSchema.safeParse({ deletedBrandId: 'bad' });
		expect(result.success).toBe(false);
	});
});

// ── QuickCreateBrandSchema ──────────────────────────────────────────────

describe('QuickCreateBrandSchema', () => {
	it('is the same schema as CreateBrandSchema', () => {
		const result = QuickCreateBrandSchema.safeParse({ name: 'Quick Brand', website: '' });
		expect(result.success).toBe(true);
	});
});
