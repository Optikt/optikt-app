import { describe, it, expect, vi } from 'vitest';
import { generateUUID } from './generateUUID';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateUUID', () => {
	it('returns a string', () => {
		expect(typeof generateUUID()).toBe('string');
	});

	it('returns a valid UUID v4 format', () => {
		const uuid = generateUUID();

		expect(uuid).toMatch(UUID_REGEX);
	});

	it('returns unique values on successive calls', () => {
		const a = generateUUID();
		const b = generateUUID();

		expect(a).not.toBe(b);
	});

	it('has the correct length (36 characters)', () => {
		expect(generateUUID()).toHaveLength(36);
	});

	it('always has version 4 indicator at position 14', () => {
		for (let i = 0; i < 20; i++) {
			const uuid = generateUUID();
			expect(uuid[14]).toBe('4');
		}
	});

	it('always has variant bits (8, 9, a, b) at position 19', () => {
		for (let i = 0; i < 20; i++) {
			const uuid = generateUUID();
			expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
		}
	});

	describe('fallback path (no crypto.randomUUID)', () => {
		it('generates valid UUID v4 when crypto.randomUUID is unavailable', () => {
			const originalRandomUUID = crypto.randomUUID;
			try {
				// Force the fallback by removing randomUUID
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(crypto as any).randomUUID = undefined;

				const uuid = generateUUID();

				expect(uuid).toMatch(UUID_REGEX);
			} finally {
				crypto.randomUUID = originalRandomUUID;
			}
		});
	});
});

describe('default export', () => {
	it('exports generateUUID as default', async () => {
		const mod = await import('./generateUUID');

		expect(mod.default).toBe(mod.generateUUID);
	});
});
