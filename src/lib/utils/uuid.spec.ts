import { describe, it, expect } from 'vitest';
import { isValidUuid } from './uuid';

describe('isValidUuid', () => {
	it('returns true for valid v4 UUIDs', () => {
		expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
		expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
	});

	it('returns false for invalid values', () => {
		expect(isValidUuid('not-a-uuid')).toBe(false);
		expect(isValidUuid('123')).toBe(false);
		expect(isValidUuid('550e8400-e29b-41d4-a716-44665544')).toBe(false);
		expect(isValidUuid(null as unknown)).toBe(false);
	});
});
