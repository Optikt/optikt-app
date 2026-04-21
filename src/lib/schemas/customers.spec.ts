import { describe, it, expect } from 'vitest';
import {
	ListCustomersSchema,
	CustomerIdSchema,
	CreateCustomerSchema,
	UpdateCustomerSchema,
	CreateCustomerWithPrescriptionSchema,
	ReactivateCustomerSchema
} from '$lib/schemas/customers';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeCustomer(overrides: Record<string, unknown> = {}) {
	return {
		firstName: 'Juan',
		lastName: 'Pérez',
		idNumber: 'V-12345678',
		birthDate: '1990-05-15',
		primaryPhone: '+584121234567',
		email: 'juan@example.com',
		address: 'Calle 1',
		notes: '',
		...overrides
	};
}

// ── ListCustomersSchema ─────────────────────────────────────────────────

describe('ListCustomersSchema', () => {
	it('applies defaults for pagination', () => {
		const result = ListCustomersSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.perPage).toBe(10);
			expect(result.data.includeDeleted).toBe(false);
		}
	});
});

// ── CustomerIdSchema ────────────────────────────────────────────────────

describe('CustomerIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = CustomerIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = CustomerIdSchema.safeParse({ id: 'bad-id' });
		expect(result.success).toBe(false);
	});
});

// ── CreateCustomerSchema ────────────────────────────────────────────────

describe('CreateCustomerSchema', () => {
	it('accepts a valid customer', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer());
		expect(result.success).toBe(true);
	});

	it('rejects empty firstName', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ firstName: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects empty lastName', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ lastName: '' }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid idNumber format', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ idNumber: '1234' }));
		expect(result.success).toBe(false);
	});

	it('accepts valid idNumber formats', () => {
		for (const id of ['V-12345678', 'E-123456', 'J-12345678', 'G-12345678']) {
			const result = CreateCustomerSchema.safeParse(makeCustomer({ idNumber: id }));
			expect(result.success).toBe(true);
		}
	});

	it('rejects invalid birthDate', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ birthDate: 'not-a-date' }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid phone number', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ primaryPhone: '123' }));
		expect(result.success).toBe(false);
	});

	it('accepts empty email (optional)', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ email: '' }));
		expect(result.success).toBe(true);
	});

	it('rejects malformed email', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ email: 'bad-email' }));
		expect(result.success).toBe(false);
	});

	it('allows optional fields to be omitted', () => {
		const result = CreateCustomerSchema.safeParse({
			firstName: 'Ana',
			lastName: 'Gómez',
			idNumber: 'V-87654321',
			birthDate: '1985-12-01',
			primaryPhone: '+584141234567',
			email: ''
		});
		expect(result.success).toBe(true);
	});

	it('accepts optional secondaryPhones array', () => {
		const result = CreateCustomerSchema.safeParse(
			makeCustomer({ secondaryPhones: ['+584161234567'] })
		);
		expect(result.success).toBe(true);
	});

	it('rejects invalid secondary phone in array', () => {
		const result = CreateCustomerSchema.safeParse(makeCustomer({ secondaryPhones: ['123'] }));
		expect(result.success).toBe(false);
	});
});

// ── UpdateCustomerSchema ────────────────────────────────────────────────

describe('UpdateCustomerSchema', () => {
	it('accepts a valid update with id and partial fields', () => {
		const result = UpdateCustomerSchema.safeParse({
			id: crypto.randomUUID(),
			firstName: 'Updated'
		});
		expect(result.success).toBe(true);
	});

	it('requires a valid UUID for id', () => {
		const result = UpdateCustomerSchema.safeParse({ id: 'bad', firstName: 'Test' });
		expect(result.success).toBe(false);
	});

	it('accepts update with only id', () => {
		const result = UpdateCustomerSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});
});

// ── CreateCustomerWithPrescriptionSchema ────────────────────────────────

describe('CreateCustomerWithPrescriptionSchema', () => {
	it('accepts customer without prescription', () => {
		const result = CreateCustomerWithPrescriptionSchema.safeParse(makeCustomer());
		expect(result.success).toBe(true);
	});

	it('accepts customer with a valid prescription', () => {
		const result = CreateCustomerWithPrescriptionSchema.safeParse(
			makeCustomer({
				prescription: {
					prescriptionDate: '2024-01-15',
					odSphere: -2.0,
					odCylinder: -0.5,
					odAxis: 90,
					osSphere: -1.75,
					osCylinder: -0.25,
					osAxis: 85,
					recommendedLensType: 'MONOFOCAL',
					doctorName: 'Dr. García'
				}
			})
		);
		expect(result.success).toBe(true);
	});
});

// ── ReactivateCustomerSchema ────────────────────────────────────────────

describe('ReactivateCustomerSchema', () => {
	it('accepts a valid UUID', () => {
		const result = ReactivateCustomerSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects missing id', () => {
		const result = ReactivateCustomerSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
