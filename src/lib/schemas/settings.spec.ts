import { describe, it, expect } from 'vitest';
import {
	UpdateSettingsSchema,
	UpdateProfileSchema,
	ChangePasswordSchema
} from '$lib/schemas/settings';

// ── UpdateSettingsSchema ────────────────────────────────────────────────

describe('UpdateSettingsSchema', () => {
	it('accepts minimal settings with required email field', () => {
		const result = UpdateSettingsSchema.safeParse({ businessEmail: '' });
		expect(result.success).toBe(true);
	});

	it('accepts full settings', () => {
		const result = UpdateSettingsSchema.safeParse({
			businessName: 'Óptica Central',
			businessRif: 'J-12345678-4',
			businessPhone: '+584121234567',
			businessEmail: 'info@optica.com',
			businessAddress: 'Av. Principal',
			businessWebsite: 'https://optica.com',
			businessLogo: 'logo.png'
		});
		expect(result.success).toBe(true);
	});

	it('accepts empty email string', () => {
		const result = UpdateSettingsSchema.safeParse({ businessEmail: '' });
		expect(result.success).toBe(true);
	});

	it('rejects invalid email format', () => {
		const result = UpdateSettingsSchema.safeParse({ businessEmail: 'not-email' });
		expect(result.success).toBe(false);
	});

	it('accepts empty RIF (optional)', () => {
		const result = UpdateSettingsSchema.safeParse({ businessEmail: '', businessRif: '' });
		expect(result.success).toBe(true);
	});

	it('rejects invalid RIF format', () => {
		const result = UpdateSettingsSchema.safeParse({
			businessEmail: '',
			businessRif: 'INVALID'
		});
		expect(result.success).toBe(false);
	});
});

// ── UpdateProfileSchema ─────────────────────────────────────────────────

describe('UpdateProfileSchema', () => {
	it('accepts valid profile', () => {
		const result = UpdateProfileSchema.safeParse({
			fullName: 'Carlos López',
			email: 'carlos@example.com'
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty fullName', () => {
		const result = UpdateProfileSchema.safeParse({
			fullName: '',
			email: 'carlos@example.com'
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid email', () => {
		const result = UpdateProfileSchema.safeParse({
			fullName: 'Carlos',
			email: 'bad'
		});
		expect(result.success).toBe(false);
	});

	it('rejects missing email', () => {
		const result = UpdateProfileSchema.safeParse({ fullName: 'Carlos' });
		expect(result.success).toBe(false);
	});

	it('rejects missing fullName', () => {
		const result = UpdateProfileSchema.safeParse({ email: 'test@test.com' });
		expect(result.success).toBe(false);
	});

	it('rejects fullName exceeding 100 characters', () => {
		const result = UpdateProfileSchema.safeParse({
			fullName: 'A'.repeat(101),
			email: 'test@test.com'
		});
		expect(result.success).toBe(false);
	});
});

// ── ChangePasswordSchema ────────────────────────────────────────────────

describe('ChangePasswordSchema', () => {
	it('accepts valid password change', () => {
		const result = ChangePasswordSchema.safeParse({
			currentPassword: 'oldpass123',
			newPassword: 'newpass456',
			confirmPassword: 'newpass456'
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty currentPassword', () => {
		const result = ChangePasswordSchema.safeParse({
			currentPassword: '',
			newPassword: 'newpass456',
			confirmPassword: 'newpass456'
		});
		expect(result.success).toBe(false);
	});

	it('rejects newPassword shorter than 8 characters', () => {
		const result = ChangePasswordSchema.safeParse({
			currentPassword: 'oldpass123',
			newPassword: 'short',
			confirmPassword: 'short'
		});
		expect(result.success).toBe(false);
	});

	it('rejects newPassword longer than 24 characters', () => {
		const result = ChangePasswordSchema.safeParse({
			currentPassword: 'oldpass123',
			newPassword: 'a'.repeat(25),
			confirmPassword: 'a'.repeat(25)
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty confirmPassword', () => {
		const result = ChangePasswordSchema.safeParse({
			currentPassword: 'oldpass123',
			newPassword: 'newpass456',
			confirmPassword: ''
		});
		expect(result.success).toBe(false);
	});

	it('rejects missing fields', () => {
		const result = ChangePasswordSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
