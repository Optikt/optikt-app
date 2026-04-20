/**
 * User Roles Enum
 * Shared between client and server for type safety
 */

import type { BadgeVariant } from '$lib/shared/badge-variants';

export enum UserRole {
	ADMIN = 'ADMIN',
	MANAGER = 'MANAGER',
	SELLER = 'SELLER',
	VIEWER = 'VIEWER'
}

/**
 * Role badge colors for consistent UI display
 */
export const roleBadgeColors: Record<UserRole, BadgeVariant> = {
	[UserRole.ADMIN]: 'purple',
	[UserRole.MANAGER]: 'info',
	[UserRole.SELLER]: 'success',
	[UserRole.VIEWER]: 'neutral'
};

/**
 * Get the badge color for a user role
 */
export function getUserRoleBadgeColor(role: string): BadgeVariant {
	return roleBadgeColors[role as UserRole] ?? 'neutral';
}

/**
 * Helper function to check if a role has admin privileges (ADMIN or MANAGER)
 */
export function isAdminRole(role: UserRole | undefined | null): boolean {
	if (!role) return false;
	return role === UserRole.ADMIN || role === UserRole.MANAGER;
}

/**
 * Helper to check if a role can perform operations (anything except VIEWER)
 */
export function canOperate(role: UserRole | undefined | null): boolean {
	if (!role) return false;
	return role !== UserRole.VIEWER;
}

/**
 * Get all role values as an array
 */
export const ALL_ROLES = Object.values(UserRole);
