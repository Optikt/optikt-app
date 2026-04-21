import type { Handle, HandleServerError } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;

		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);

	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

export const handleError: HandleServerError = ({ error }) => {
    const err = error as { message?: string; cause?: unknown };
    console.error('[handleError]', err?.message);
    if (err?.cause) console.error('[handleError cause]', err.cause);
    return { message: 'Internal Error' };
};

export const handle: Handle = handleAuth;
