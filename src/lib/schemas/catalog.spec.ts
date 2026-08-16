import { describe, it, expect } from 'vitest';
import { CatalogSearchSchema } from './catalog';

describe('CatalogSearchSchema', () => {
	it('defaults to limit 20', () => {
		expect(CatalogSearchSchema.parse({}).limit).toBe(20);
	});

	it('accepts query and supplierId', () => {
		const result = CatalogSearchSchema.parse({
			q: '  ray ban  ',
			supplierId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
			limit: 10
		});
		expect(result.q).toBe('ray ban');
		expect(result.limit).toBe(10);
	});

	it('rejects invalid supplierId', () => {
		expect(() => CatalogSearchSchema.parse({ supplierId: 'not-a-uuid' })).toThrow();
	});

	it('rejects limit out of range', () => {
		expect(() => CatalogSearchSchema.parse({ limit: 0 })).toThrow();
		expect(() => CatalogSearchSchema.parse({ limit: 100 })).toThrow();
	});

	it('allows empty input (no filters → no results)', () => {
		expect(CatalogSearchSchema.parse({}).q).toBeUndefined();
	});
});
