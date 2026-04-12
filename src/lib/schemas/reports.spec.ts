import { describe, it, expect } from 'vitest';
import { DateRangeSchema } from '$lib/schemas/reports';

// ── DateRangeSchema ─────────────────────────────────────────────────────

describe('DateRangeSchema', () => {
	it('accepts valid date range', () => {
		const result = DateRangeSchema.safeParse({
			dateFrom: '2024-01-01',
			dateTo: '2024-12-31'
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty dateFrom', () => {
		const result = DateRangeSchema.safeParse({ dateFrom: '', dateTo: '2024-12-31' });
		expect(result.success).toBe(false);
	});

	it('rejects empty dateTo', () => {
		const result = DateRangeSchema.safeParse({ dateFrom: '2024-01-01', dateTo: '' });
		expect(result.success).toBe(false);
	});

	it('rejects missing dateFrom', () => {
		const result = DateRangeSchema.safeParse({ dateTo: '2024-12-31' });
		expect(result.success).toBe(false);
	});

	it('rejects missing dateTo', () => {
		const result = DateRangeSchema.safeParse({ dateFrom: '2024-01-01' });
		expect(result.success).toBe(false);
	});

	it('rejects empty object', () => {
		const result = DateRangeSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('accepts any non-empty string (no date format validation)', () => {
		const result = DateRangeSchema.safeParse({
			dateFrom: 'yesterday',
			dateTo: 'today'
		});
		expect(result.success).toBe(true);
	});
});
