import { describe, it, expect } from 'vitest';
import { loginSchema } from '$lib/schemas/auth';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeLogin(overrides: Record<string, unknown> = {}) {
	return {
		identifier: 'admin_user',
		password: 'securePass1',
		...overrides
	};
}

// ── loginSchema ─────────────────────────────────────────────────────────

describe('loginSchema', () => {
	it('accepts valid credentials', () => {
		const result = loginSchema.safeParse(makeLogin());
		expect(result.success).toBe(true);
	});

	it('trims and lowercases the identifier', () => {
		const result = loginSchema.safeParse(makeLogin({ identifier: '  ADMIN_USER  ' }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.identifier).toBe('admin_user');
		}
	});

	it('rejects identifier shorter than 4 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ identifier: 'abc' }));
		expect(result.success).toBe(false);
	});

	it('accepts identifier with exactly 4 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ identifier: 'abcd' }));
		expect(result.success).toBe(true);
	});

	it('rejects identifier longer than 255 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ identifier: 'a'.repeat(256) }));
		expect(result.success).toBe(false);
	});

	it('rejects empty identifier', () => {
		const result = loginSchema.safeParse(makeLogin({ identifier: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects missing identifier', () => {
		const { identifier: _, ...rest } = makeLogin();
		const result = loginSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('rejects password shorter than 8 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ password: 'short' }));
		expect(result.success).toBe(false);
	});

	it('rejects password longer than 24 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ password: 'a'.repeat(25) }));
		expect(result.success).toBe(false);
	});

	it('rejects missing password', () => {
		const { password: _, ...rest } = makeLogin();
		const result = loginSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('accepts password with exactly 8 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ password: '12345678' }));
		expect(result.success).toBe(true);
	});

	it('accepts password with exactly 24 characters', () => {
		const result = loginSchema.safeParse(makeLogin({ password: 'a'.repeat(24) }));
		expect(result.success).toBe(true);
	});
});
