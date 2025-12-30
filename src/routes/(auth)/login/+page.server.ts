import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas/auth';
import * as auth from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect to dashboard
	if (locals.user) {
		redirect(302, '/dashboard');
	}

	// Initialize empty form
	const form = await superValidate(zod4(loginSchema));
	return { form };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(loginSchema));

		// Return validation errors
		if (!form.valid) {
			return fail(400, { form });
		}

		const { identifier, password } = form.data;

		// Find user by email or username (case-insensitive)
		const user = await auth.findUserByIdentifier(identifier);

		if (!user) {
			return message(form, 'Credenciales incorrectas', { status: 400 });
		}

		// Check if user is active
		if (!user.isActive) {
			return message(form, 'Tu cuenta está desactivada. Contacta al administrador.', {
				status: 400
			});
		}

		// Verify password
		const validPassword = await verify(user.hashedPassword, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return message(form, 'Credenciales incorrectas', { status: 400 });
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
