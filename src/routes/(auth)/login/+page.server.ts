import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import * as auth from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect to dashboard
	if (locals.user) {
		redirect(302, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const identifier = formData.get('identifier');
		const password = formData.get('password');

		// Validate inputs
		if (!identifier || typeof identifier !== 'string' || identifier.length < 3) {
			return fail(400, { message: 'Usuario o email inválido' });
		}

		if (!password || typeof password !== 'string' || password.length < 6) {
			return fail(400, { message: 'Contraseña inválida (mínimo 6 caracteres)' });
		}

		// Find user by email or username (case-insensitive)
		const user = await auth.findUserByIdentifier(identifier.trim());

		if (!user) {
			return fail(400, { message: 'Credenciales incorrectas' });
		}

		// Check if user is active
		if (!user.isActive) {
			return fail(400, { message: 'Tu cuenta está desactivada. Contacta al administrador.' });
		}

		// Verify password
		const validPassword = await verify(user.hashedPassword, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return fail(400, { message: 'Credenciales incorrectas' });
		}

		// Create session with IP and user agent
		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, user.id, {
			ipAddress: event.getClientAddress(),
			userAgent: event.request.headers.get('user-agent') ?? undefined
		});

		// Set session cookie
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

		// Redirect to dashboard
		redirect(302, '/dashboard');
	}
};
