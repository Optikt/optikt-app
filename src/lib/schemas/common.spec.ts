import { describe, it, expect } from 'vitest';
import {
	PhoneSchema,
	OptionalPhoneSchema,
	WhatsAppSchema,
	InstagramSchema,
	RifSchema,
	OptionalRifSchema,
	IdNumberSchema,
	OptionalIdNumberSchema,
	OptionalCoercedInteger
} from './common';

// =============================================================================
// Phone Schemas
// =============================================================================

describe('PhoneSchema', () => {
	it('accepts valid Venezuelan phone numbers', () => {
		expect(PhoneSchema.safeParse('+584121234567').success).toBe(true);
		expect(PhoneSchema.safeParse('04121234567').success).toBe(true);
	});

	it('rejects phone numbers with less than 7 digits', () => {
		const result = PhoneSchema.safeParse('12345');
		expect(result.success).toBe(false);
	});

	it('rejects invalid phone numbers', () => {
		expect(PhoneSchema.safeParse('not-a-phone').success).toBe(false);
		expect(PhoneSchema.safeParse('1234567890123456789').success).toBe(false);
	});
});

describe('OptionalPhoneSchema', () => {
	it('accepts empty string', () => {
		expect(OptionalPhoneSchema.safeParse('').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(OptionalPhoneSchema.safeParse(undefined).success).toBe(true);
	});

	it('accepts valid phone when provided', () => {
		expect(OptionalPhoneSchema.safeParse('+584121234567').success).toBe(true);
	});
});

// =============================================================================
// WhatsApp Schema
// =============================================================================

describe('WhatsAppSchema', () => {
	it('accepts empty string', () => {
		expect(WhatsAppSchema.safeParse('').success).toBe(true);
	});

	it('accepts valid international phone numbers', () => {
		expect(WhatsAppSchema.safeParse('+584121234567').success).toBe(true);
		expect(WhatsAppSchema.safeParse('+12025551234').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(WhatsAppSchema.safeParse(undefined).success).toBe(true);
	});
});

// =============================================================================
// Instagram Schema
// =============================================================================

describe('InstagramSchema', () => {
	it('accepts empty string', () => {
		expect(InstagramSchema.safeParse('').success).toBe(true);
	});

	it('accepts valid Instagram usernames starting with @', () => {
		expect(InstagramSchema.safeParse('@username').success).toBe(true);
		expect(InstagramSchema.safeParse('@user.name').success).toBe(true);
		expect(InstagramSchema.safeParse('@user_name123').success).toBe(true);
	});

	it('rejects usernames without @', () => {
		expect(InstagramSchema.safeParse('username').success).toBe(false);
	});

	it('rejects usernames with invalid characters', () => {
		expect(InstagramSchema.safeParse('@user name').success).toBe(false);
		expect(InstagramSchema.safeParse('@user@name').success).toBe(false);
	});
});

// =============================================================================
// RIF Schema (using correct check digits)
// =============================================================================

describe('RifSchema', () => {
	it('accepts valid RIF with correct format and check digit', () => {
		// V-12345678 -> check digit is 1
		expect(RifSchema.safeParse('V-12345678-1').success).toBe(true);
		// J-00000001 -> check digit is 8
		expect(RifSchema.safeParse('J-00000001-8').success).toBe(true);
	});

	it('rejects RIF with invalid format', () => {
		expect(RifSchema.safeParse('V123456781').success).toBe(false); // No dashes
		expect(RifSchema.safeParse('X-12345678-1').success).toBe(false); // Invalid type
		expect(RifSchema.safeParse('V-1234567-1').success).toBe(false); // 7 digits
	});

	it('rejects RIF with incorrect check digit', () => {
		expect(RifSchema.safeParse('V-12345678-0').success).toBe(false);
		expect(RifSchema.safeParse('V-12345678-9').success).toBe(false);
	});
});

describe('OptionalRifSchema', () => {
	it('accepts empty string', () => {
		expect(OptionalRifSchema.safeParse('').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(OptionalRifSchema.safeParse(undefined).success).toBe(true);
	});

	it('accepts valid RIF when provided', () => {
		expect(OptionalRifSchema.safeParse('V-12345678-1').success).toBe(true);
	});

	it('rejects invalid RIF when provided', () => {
		expect(OptionalRifSchema.safeParse('invalid').success).toBe(false);
	});
});

// =============================================================================
// ID Number (Cédula) Schema
// =============================================================================

describe('IdNumberSchema', () => {
	it('accepts valid Venezuelan ID (V prefix)', () => {
		expect(IdNumberSchema.safeParse('V-12345678').success).toBe(true);
		expect(IdNumberSchema.safeParse('V-123456').success).toBe(true); // 6 digits minimum
		expect(IdNumberSchema.safeParse('V-1234567890').success).toBe(true); // 10 digits max
	});

	it('accepts valid foreigner ID (E prefix)', () => {
		expect(IdNumberSchema.safeParse('E-12345678').success).toBe(true);
		expect(IdNumberSchema.safeParse('E-123456').success).toBe(true);
	});

	it('rejects ID without proper format', () => {
		expect(IdNumberSchema.safeParse('12345678').success).toBe(false); // No prefix
		expect(IdNumberSchema.safeParse('V12345678').success).toBe(false); // No dash
		expect(IdNumberSchema.safeParse('X-12345678').success).toBe(false); // Invalid prefix
	});

	it('rejects ID with too few or too many digits', () => {
		expect(IdNumberSchema.safeParse('V-12345').success).toBe(false); // 5 digits
		expect(IdNumberSchema.safeParse('V-12345678901').success).toBe(false); // 11 digits
	});
});

describe('OptionalIdNumberSchema', () => {
	it('accepts empty string', () => {
		expect(OptionalIdNumberSchema.safeParse('').success).toBe(true);
	});

	it('accepts undefined', () => {
		expect(OptionalIdNumberSchema.safeParse(undefined).success).toBe(true);
	});

	it('accepts valid ID when provided', () => {
		expect(OptionalIdNumberSchema.safeParse('V-12345678').success).toBe(true);
	});

	it('rejects invalid ID when provided', () => {
		expect(OptionalIdNumberSchema.safeParse('invalid').success).toBe(false);
	});
});

// =============================================================================
// OptionalCoercedInteger Schema
// =============================================================================

describe('OptionalCoercedInteger', () => {
	const schema = OptionalCoercedInteger({ min: 10, max: 80 });

	it('converts empty string to undefined', () => {
		const result = schema.safeParse('');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeUndefined();
		}
	});

	it('converts null to undefined', () => {
		const result = schema.safeParse(null);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeUndefined();
		}
	});

	it('accepts undefined', () => {
		const result = schema.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeUndefined();
		}
	});

	it('accepts intentional 0 as valid value', () => {
		const schemaWithLowMin = OptionalCoercedInteger({ min: 0, max: 100 });
		const result = schemaWithLowMin.safeParse('0');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(0);
		}
	});

	it('accepts valid integer values', () => {
		expect(schema.safeParse('50').success).toBe(true);
		expect(schema.safeParse('80').success).toBe(true);
		expect(schema.safeParse(45).success).toBe(true);
		expect(schema.safeParse(80).success).toBe(true);
	});

	it('rejects values outside min/max range', () => {
		expect(schema.safeParse('9').success).toBe(false);
		expect(schema.safeParse('81').success).toBe(false);
		expect(schema.safeParse(9).success).toBe(false);
		expect(schema.safeParse(81).success).toBe(false);
	});

	it('rejects string floats', () => {
		const result = schema.safeParse('50.5');
		expect(result.success).toBe(false);
	});

	it('rejects number floats', () => {
		const result = schema.safeParse(50.5);
		expect(result.success).toBe(false);
	});

	it('rejects non-numeric strings', () => {
		const result = schema.safeParse('abc');
		expect(result.success).toBe(false);
	});

	it('works without constraints', () => {
		const noConstraintsSchema = OptionalCoercedInteger();
		expect(noConstraintsSchema.safeParse('').success).toBe(true);
		expect(noConstraintsSchema.safeParse('1000').success).toBe(true);
		expect(noConstraintsSchema.safeParse('-1000').success).toBe(true);
	});
});
