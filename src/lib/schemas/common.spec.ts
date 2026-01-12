import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	PhoneSchema,
	OptionalPhoneSchema,
	WhatsAppSchema,
	InstagramSchema,
	RifSchema,
	OptionalRifSchema,
	IdNumberSchema,
	OptionalIdNumberSchema
} from './common';

// =============================================================================
// Phone Schemas
// =============================================================================

describe('PhoneSchema', () => {
	it('accepts valid Venezuelan phone numbers', () => {
		expect(v.safeParse(PhoneSchema, '+584121234567').success).toBe(true);
		expect(v.safeParse(PhoneSchema, '04121234567').success).toBe(true);
	});

	it('rejects phone numbers with less than 7 digits', () => {
		const result = v.safeParse(PhoneSchema, '12345');
		expect(result.success).toBe(false);
	});

	it('rejects invalid phone numbers', () => {
		expect(v.safeParse(PhoneSchema, 'not-a-phone').success).toBe(false);
		expect(v.safeParse(PhoneSchema, '1234567890123456789').success).toBe(false);
	});
});

describe('OptionalPhoneSchema', () => {
	it('accepts empty string', () => {
		expect(v.safeParse(OptionalPhoneSchema, '').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(v.safeParse(OptionalPhoneSchema, undefined).success).toBe(true);
	});

	it('accepts valid phone when provided', () => {
		expect(v.safeParse(OptionalPhoneSchema, '+584121234567').success).toBe(true);
	});
});

// =============================================================================
// WhatsApp Schema
// =============================================================================

describe('WhatsAppSchema', () => {
	it('accepts empty string', () => {
		expect(v.safeParse(WhatsAppSchema, '').success).toBe(true);
	});

	it('accepts valid international phone numbers', () => {
		expect(v.safeParse(WhatsAppSchema, '+584121234567').success).toBe(true);
		expect(v.safeParse(WhatsAppSchema, '+12025551234').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(v.safeParse(WhatsAppSchema, undefined).success).toBe(true);
	});
});

// =============================================================================
// Instagram Schema
// =============================================================================

describe('InstagramSchema', () => {
	it('accepts empty string', () => {
		expect(v.safeParse(InstagramSchema, '').success).toBe(true);
	});

	it('accepts valid Instagram usernames starting with @', () => {
		expect(v.safeParse(InstagramSchema, '@username').success).toBe(true);
		expect(v.safeParse(InstagramSchema, '@user.name').success).toBe(true);
		expect(v.safeParse(InstagramSchema, '@user_name123').success).toBe(true);
	});

	it('rejects usernames without @', () => {
		expect(v.safeParse(InstagramSchema, 'username').success).toBe(false);
	});

	it('rejects usernames with invalid characters', () => {
		expect(v.safeParse(InstagramSchema, '@user name').success).toBe(false);
		expect(v.safeParse(InstagramSchema, '@user@name').success).toBe(false);
	});
});

// =============================================================================
// RIF Schema (using correct check digits)
// =============================================================================

describe('RifSchema', () => {
	it('accepts valid RIF with correct format and check digit', () => {
		// V-12345678 -> check digit is 1
		expect(v.safeParse(RifSchema, 'V-12345678-1').success).toBe(true);
		// J-00000001 -> check digit is 8
		expect(v.safeParse(RifSchema, 'J-00000001-8').success).toBe(true);
	});

	it('rejects RIF with invalid format', () => {
		expect(v.safeParse(RifSchema, 'V123456781').success).toBe(false); // No dashes
		expect(v.safeParse(RifSchema, 'X-12345678-1').success).toBe(false); // Invalid type
		expect(v.safeParse(RifSchema, 'V-1234567-1').success).toBe(false); // 7 digits
	});

	it('rejects RIF with incorrect check digit', () => {
		expect(v.safeParse(RifSchema, 'V-12345678-0').success).toBe(false);
		expect(v.safeParse(RifSchema, 'V-12345678-9').success).toBe(false);
	});
});

describe('OptionalRifSchema', () => {
	it('accepts empty string', () => {
		expect(v.safeParse(OptionalRifSchema, '').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(v.safeParse(OptionalRifSchema, undefined).success).toBe(true);
	});

	it('accepts valid RIF when provided', () => {
		expect(v.safeParse(OptionalRifSchema, 'V-12345678-1').success).toBe(true);
	});

	it('rejects invalid RIF when provided', () => {
		expect(v.safeParse(OptionalRifSchema, 'invalid').success).toBe(false);
	});
});

// =============================================================================
// ID Number (Cédula) Schema
// =============================================================================

describe('IdNumberSchema', () => {
	it('accepts valid Venezuelan ID (V prefix)', () => {
		expect(v.safeParse(IdNumberSchema, 'V-12345678').success).toBe(true);
		expect(v.safeParse(IdNumberSchema, 'V-123456').success).toBe(true); // 6 digits minimum
		expect(v.safeParse(IdNumberSchema, 'V-1234567890').success).toBe(true); // 10 digits max
	});

	it('accepts valid foreigner ID (E prefix)', () => {
		expect(v.safeParse(IdNumberSchema, 'E-12345678').success).toBe(true);
		expect(v.safeParse(IdNumberSchema, 'E-123456').success).toBe(true);
	});

	it('rejects ID without proper format', () => {
		expect(v.safeParse(IdNumberSchema, '12345678').success).toBe(false); // No prefix
		expect(v.safeParse(IdNumberSchema, 'V12345678').success).toBe(false); // No dash
		expect(v.safeParse(IdNumberSchema, 'X-12345678').success).toBe(false); // Invalid prefix
	});

	it('rejects ID with too few or too many digits', () => {
		expect(v.safeParse(IdNumberSchema, 'V-12345').success).toBe(false); // 5 digits
		expect(v.safeParse(IdNumberSchema, 'V-12345678901').success).toBe(false); // 11 digits
	});
});

describe('OptionalIdNumberSchema', () => {
	it('accepts empty string', () => {
		expect(v.safeParse(OptionalIdNumberSchema, '').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(v.safeParse(OptionalIdNumberSchema, undefined).success).toBe(true);
	});

	it('accepts valid ID when provided', () => {
		expect(v.safeParse(OptionalIdNumberSchema, 'V-12345678').success).toBe(true);
	});

	it('rejects invalid ID when provided', () => {
		expect(v.safeParse(OptionalIdNumberSchema, 'invalid').success).toBe(false);
	});
});
