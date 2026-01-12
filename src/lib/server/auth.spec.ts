import { describe, it, expect } from 'vitest';
import { generateSessionToken, getTokenHash, sessionCookieName } from './auth';

describe('sessionCookieName', () => {
	it('has correct value', () => {
		expect(sessionCookieName).toBe('auth-session');
	});
});

describe('generateSessionToken', () => {
	it('generates a non-empty string', () => {
		const token = generateSessionToken();
		expect(token).toBeTruthy();
		expect(typeof token).toBe('string');
	});

	it('generates tokens of consistent length', () => {
		const token1 = generateSessionToken();
		const token2 = generateSessionToken();
		// Base64url encoding of 18 bytes = 24 characters
		expect(token1.length).toBe(24);
		expect(token2.length).toBe(24);
	});

	it('generates unique tokens', () => {
		const tokens = new Set<string>();
		for (let i = 0; i < 100; i++) {
			tokens.add(generateSessionToken());
		}
		// All 100 tokens should be unique
		expect(tokens.size).toBe(100);
	});

	it('generates URL-safe tokens (no special characters)', () => {
		const token = generateSessionToken();
		// Base64url should only contain alphanumeric, -, and _
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe('getTokenHash', () => {
	it('returns a non-empty string', () => {
		const hash = getTokenHash('test-token');
		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('returns consistent hash for same input', () => {
		const hash1 = getTokenHash('same-token');
		const hash2 = getTokenHash('same-token');
		expect(hash1).toBe(hash2);
	});

	it('returns different hash for different input', () => {
		const hash1 = getTokenHash('token-1');
		const hash2 = getTokenHash('token-2');
		expect(hash1).not.toBe(hash2);
	});

	it('returns hex-encoded lowercase string', () => {
		const hash = getTokenHash('test');
		// SHA-256 produces 64 hex characters
		expect(hash.length).toBe(64);
		expect(hash).toMatch(/^[0-9a-f]+$/);
	});

	it('produces known SHA-256 hash', () => {
		// "test" in SHA-256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
		const hash = getTokenHash('test');
		expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
	});
});
