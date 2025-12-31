/**
 * Auth Guards for Remote Functions
 * Reusable security helpers using getRequestEvent()
 */
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';

/**
 * Get current user from request (via hooks.server.ts)
 */
export function getCurrentUser() {
	const { locals } = getRequestEvent();
	return locals.user;
}

/**
 * Get current session from request
 */
export function getCurrentSession() {
	const { locals } = getRequestEvent();
	return locals.session;
}

/**
 * Require authenticated user - throws 401 if not logged in
 */
export function requireAuth() {
	const user = getCurrentUser();
	if (!user) {
		error(401, 'No autorizado');
	}
	return user;
}

/**
 * Require specific role(s) - throws 403 if user doesn't have required role
 * @param allowedRoles - List of roles that are allowed
 */
export function requireRole(...allowedRoles: string[]) {
	const user = requireAuth();
	if (!allowedRoles.includes(user.role)) {
		error(403, 'No tienes permisos para esta acción');
	}
	return user;
}

/**
 * Require superuser - throws 403 if not superadmin
 */
export function requireSuperuser() {
	const user = requireAuth();
	if (!user.isSuperuser) {
		error(403, 'Solo superadmin puede realizar esta acción');
	}
	return user;
}
