import { UserRole } from '$lib/shared/enums';

/**
 * Returns true if a MANAGER is trying to delete an ADMIN or another MANAGER.
 */
export function isManagerDeletingProtectedRole(
	callerRole: UserRole,
	targetRole: UserRole
): boolean {
	return (
		callerRole === UserRole.MANAGER &&
		(targetRole === UserRole.ADMIN || targetRole === UserRole.MANAGER)
	);
}

/**
 * Returns true if the target is the last active ADMIN in the system.
 */
export function isLastAdmin(targetRole: UserRole, activeAdminCount: number): boolean {
	return targetRole === UserRole.ADMIN && activeAdminCount <= 1;
}
