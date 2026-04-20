import { describe, it, expect } from 'vitest';
import { UserRole, isAdminRole, ALL_ROLES, canManageSaleByOwner } from './roles';

describe('UserRole enum', () => {
	it('has all expected roles', () => {
		expect(UserRole.ADMIN).toBe('ADMIN');
		expect(UserRole.MANAGER).toBe('MANAGER');
		expect(UserRole.SELLER).toBe('SELLER');
		expect(UserRole.VIEWER).toBe('VIEWER');
	});

	it('ALL_ROLES contains all roles', () => {
		expect(ALL_ROLES).toHaveLength(4);
		expect(ALL_ROLES).toContain(UserRole.ADMIN);
		expect(ALL_ROLES).toContain(UserRole.MANAGER);
		expect(ALL_ROLES).toContain(UserRole.SELLER);
		expect(ALL_ROLES).toContain(UserRole.VIEWER);
	});
});

describe('isAdminRole', () => {
	it('returns true for ADMIN', () => {
		expect(isAdminRole(UserRole.ADMIN)).toBe(true);
	});

	it('returns true for MANAGER', () => {
		expect(isAdminRole(UserRole.MANAGER)).toBe(true);
	});

	it('returns false for SELLER', () => {
		expect(isAdminRole(UserRole.SELLER)).toBe(false);
	});

	it('returns false for VIEWER', () => {
		expect(isAdminRole(UserRole.VIEWER)).toBe(false);
	});

	it('returns false for null', () => {
		expect(isAdminRole(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isAdminRole(undefined)).toBe(false);
	});
});

describe('canManageSaleByOwner', () => {
	it('allows ADMIN to manage any sale', () => {
		expect(canManageSaleByOwner(UserRole.ADMIN, 'user-1', 'user-2')).toBe(true);
	});

	it('allows MANAGER to manage any sale', () => {
		expect(canManageSaleByOwner(UserRole.MANAGER, 'user-1', 'user-2')).toBe(true);
	});

	it('allows SELLER to manage own sale', () => {
		expect(canManageSaleByOwner(UserRole.SELLER, 'user-1', 'user-1')).toBe(true);
	});

	it('prevents SELLER from managing another seller sale', () => {
		expect(canManageSaleByOwner(UserRole.SELLER, 'user-1', 'user-2')).toBe(false);
	});

	it('prevents SELLER from managing sale without ownership context', () => {
		expect(canManageSaleByOwner(UserRole.SELLER, 'user-1', null)).toBe(false);
		expect(canManageSaleByOwner(UserRole.SELLER, null, 'user-1')).toBe(false);
	});

	it('prevents VIEWER from managing any sale', () => {
		expect(canManageSaleByOwner(UserRole.VIEWER, 'user-1', 'user-1')).toBe(false);
	});

	it('prevents unknown role from managing any sale', () => {
		expect(canManageSaleByOwner(undefined, 'user-1', 'user-1')).toBe(false);
	});
});
