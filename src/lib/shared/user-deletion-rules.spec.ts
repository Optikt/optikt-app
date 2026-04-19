import { describe, it, expect } from 'vitest';
import { UserRole } from '$lib/shared/enums';
import { isManagerDeletingProtectedRole, isLastAdmin } from './user-deletion-rules';

describe('isManagerDeletingProtectedRole', () => {
	it('blocks MANAGER deleting ADMIN', () => {
		expect(isManagerDeletingProtectedRole(UserRole.MANAGER, UserRole.ADMIN)).toBe(true);
	});

	it('blocks MANAGER deleting another MANAGER', () => {
		expect(isManagerDeletingProtectedRole(UserRole.MANAGER, UserRole.MANAGER)).toBe(true);
	});

	it('allows MANAGER deleting SELLER', () => {
		expect(isManagerDeletingProtectedRole(UserRole.MANAGER, UserRole.SELLER)).toBe(false);
	});

	it('allows MANAGER deleting VIEWER', () => {
		expect(isManagerDeletingProtectedRole(UserRole.MANAGER, UserRole.VIEWER)).toBe(false);
	});

	it('allows ADMIN deleting ADMIN', () => {
		expect(isManagerDeletingProtectedRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
	});

	it('allows ADMIN deleting MANAGER', () => {
		expect(isManagerDeletingProtectedRole(UserRole.ADMIN, UserRole.MANAGER)).toBe(false);
	});
});

describe('isLastAdmin', () => {
	it('returns true when deleting the only ADMIN', () => {
		expect(isLastAdmin(UserRole.ADMIN, 1)).toBe(true);
	});

	it('returns true when admin count is 0 (edge case)', () => {
		expect(isLastAdmin(UserRole.ADMIN, 0)).toBe(true);
	});

	it('returns false when there are multiple ADMINs', () => {
		expect(isLastAdmin(UserRole.ADMIN, 2)).toBe(false);
	});

	it('returns false when deleting a non-ADMIN regardless of count', () => {
		expect(isLastAdmin(UserRole.MANAGER, 1)).toBe(false);
		expect(isLastAdmin(UserRole.SELLER, 1)).toBe(false);
		expect(isLastAdmin(UserRole.VIEWER, 1)).toBe(false);
	});
});
