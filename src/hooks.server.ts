import * as Sentry from '@sentry/sveltekit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';

const sentryDsn = process.env.SENTRY_DSN ?? process.env.PUBLIC_SENTRY_DSN;

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

const serverHandleError: HandleServerError = ({ error }) => {
	const err = error as { message?: string; cause?: unknown };
	console.error('[handleError]', err?.message);
	if (err?.cause) console.error('[handleError cause]', err.cause);
	return { message: 'Internal Error' };
};

export const handleError = sentryDsn
	? Sentry.handleErrorWithSentry(serverHandleError)
	: serverHandleError;

export const handle: Handle = sentryDsn ? sequence(Sentry.sentryHandle(), handleAuth) : handleAuth;
