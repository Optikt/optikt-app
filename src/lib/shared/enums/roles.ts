/**
 * User Roles Enum
 * Shared between client and server for type safety
 */
export enum UserRole {
	SUPERADMIN = 'SUPERADMIN',
	ADMIN = 'ADMIN',
	MANAGER = 'MANAGER',
	SELLER = 'SELLER',
	VIEWER = 'VIEWER'
}

/**
 * Helper function to check if a role has admin privileges
 */
export function isAdminRole(role: UserRole | undefined | null): boolean {
	if (!role) return false;
	return role === UserRole.SUPERADMIN || role === UserRole.ADMIN || role === UserRole.MANAGER;
}

/**
 * Helper function to check if a role is superadmin
 */
export function isSuperAdminRole(role: UserRole | undefined | null): boolean {
	return role === UserRole.SUPERADMIN;
}

/**
 * Get all role values as an array
 */
export const ALL_ROLES = Object.values(UserRole);
