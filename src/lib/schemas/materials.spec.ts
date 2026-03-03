import { describe, it, expect } from 'vitest';
import {
	ListMaterialsSchema,
	MaterialIdSchema,
	QuickCreateMaterialSchema,
	MaterialCategories
} from './materials';

describe('QuickCreateMaterialSchema', () => {
	it('accepts valid payloads with defaults', () => {
		const result = QuickCreateMaterialSchema.safeParse({ name: 'ACETATO' });
		expect(result.success).toBe(true);
		if (result.success) {
			const data = result.data;
			expect(data.productType).toBe('FRAME');
		}
	});

	it('accepts explicit productType values', () => {
		const result = QuickCreateMaterialSchema.safeParse({
			name: 'Metal',
			productType: MaterialCategories[1]
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty names', () => {
		const result = QuickCreateMaterialSchema.safeParse({ name: '' });
		expect(result.success).toBe(false);
	});
});

describe('ListMaterialsSchema', () => {
	it('defaults promise includeDeleted false', () => {
		const result = ListMaterialsSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			const data = result.data;
			expect(data.includeDeleted).toBe(false);
		}
	});

	it('accepts valid productType filters', () => {
		const result = ListMaterialsSchema.safeParse({ productType: MaterialCategories[2] });
		expect(result.success).toBe(true);
	});

	it('rejects invalid productType values', () => {
		const result = ListMaterialsSchema.safeParse({ productType: 'XXX' });
		expect(result.success).toBe(false);
	});
});

describe('MaterialIdSchema', () => {
	it('validates uuid IDs', () => {
		const result = MaterialIdSchema.safeParse({
			id: '00000000-0000-4000-8000-000000000001'
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUIDs', () => {
		const result = MaterialIdSchema.safeParse({ id: 'abc' });
		expect(result.success).toBe(false);
	});
});
