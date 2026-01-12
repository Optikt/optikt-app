import { describe, it, expect } from 'vitest';
import { UserRole, isAdminRole, isSuperAdminRole, ALL_ROLES } from './roles';

describe('UserRole enum', () => {
	it('has all expected roles', () => {
		expect(UserRole.SUPERADMIN).toBe('SUPERADMIN');
		expect(UserRole.ADMIN).toBe('ADMIN');
		expect(UserRole.MANAGER).toBe('MANAGER');
		expect(UserRole.SELLER).toBe('SELLER');
		expect(UserRole.VIEWER).toBe('VIEWER');
	});

	it('ALL_ROLES contains all roles', () => {
		expect(ALL_ROLES).toHaveLength(5);
		expect(ALL_ROLES).toContain(UserRole.SUPERADMIN);
		expect(ALL_ROLES).toContain(UserRole.ADMIN);
		expect(ALL_ROLES).toContain(UserRole.MANAGER);
		expect(ALL_ROLES).toContain(UserRole.SELLER);
		expect(ALL_ROLES).toContain(UserRole.VIEWER);
	});
});

describe('isAdminRole', () => {
	it('returns true for SUPERADMIN', () => {
		expect(isAdminRole(UserRole.SUPERADMIN)).toBe(true);
	});

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

describe('isSuperAdminRole', () => {
	it('returns true for SUPERADMIN', () => {
		expect(isSuperAdminRole(UserRole.SUPERADMIN)).toBe(true);
	});

	it('returns false for ADMIN', () => {
		expect(isSuperAdminRole(UserRole.ADMIN)).toBe(false);
	});

	it('returns false for MANAGER', () => {
		expect(isSuperAdminRole(UserRole.MANAGER)).toBe(false);
	});

	it('returns false for SELLER', () => {
		expect(isSuperAdminRole(UserRole.SELLER)).toBe(false);
	});

	it('returns false for VIEWER', () => {
		expect(isSuperAdminRole(UserRole.VIEWER)).toBe(false);
	});

	it('returns false for null', () => {
		expect(isSuperAdminRole(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isSuperAdminRole(undefined)).toBe(false);
	});
});
