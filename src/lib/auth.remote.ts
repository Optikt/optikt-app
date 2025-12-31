/**
 * Auth Remote Functions
 * Login, logout, and auth-related remote functions
 */
import { redirect, error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { verify } from '@node-rs/argon2';
import { loginSchema } from './schemas/auth';
import * as auth from './server/auth';
import { findUserByIdentifier } from './server/db/queries/users';

/**
 * LOGIN - Public form (no guard required)
 * Validates credentials and creates a session
 */
export const login = form(loginSchema, async ({ identifier, password }) => {
	const event = getRequestEvent();

	// Find user by email or username
	const user = await findUserByIdentifier(identifier);
	if (!user) {
		error(400, 'Credenciales incorrectas');
	}

	// Check if user is active
	if (!user.isActive) {
		error(400, 'Tu cuenta está desactivada. Contacta al administrador.');
	}

	// Verify password
	const validPassword = await verify(user.hashedPassword, password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	if (!validPassword) {
		error(400, 'Credenciales incorrectas');
	}

	// Create session with IP and user agent tracking
	const token = auth.generateSessionToken();
	const session = await auth.createSession(token, user.id, {
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent') ?? undefined
	});

	// Set session cookie
	auth.setSessionTokenCookie(event, token, session.expiresAt);

	// Redirect to dashboard
	redirect(303, '/dashboard');
});

/**
 * LOGOUT - Form to invalidate session and redirect
 * Using form instead of command because redirect() works in forms
 */
export const logout = form(async () => {
	const event = getRequestEvent();

	// Invalidate session in database
	if (event.locals.session) {
		await auth.invalidateSession(event.locals.session.id);
	}

	// Delete session cookie
	auth.deleteSessionTokenCookie(event);

	// Redirect to login
	redirect(303, '/login');
});
