import { describe, it, expect } from 'vitest';
import { UniversalSearchSchema } from '$lib/schemas/search';

// ── UniversalSearchSchema ───────────────────────────────────────────────

describe('UniversalSearchSchema', () => {
	it('accepts a non-empty query', () => {
		const result = UniversalSearchSchema.safeParse({ query: 'sunglasses' });
		expect(result.success).toBe(true);
	});

	it('rejects empty query', () => {
		const result = UniversalSearchSchema.safeParse({ query: '' });
		expect(result.success).toBe(false);
	});

	it('rejects missing query', () => {
		const result = UniversalSearchSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('accepts single character query', () => {
		const result = UniversalSearchSchema.safeParse({ query: 'a' });
		expect(result.success).toBe(true);
	});

	it('accepts long query', () => {
		const result = UniversalSearchSchema.safeParse({ query: 'a'.repeat(500) });
		expect(result.success).toBe(true);
	});
});
