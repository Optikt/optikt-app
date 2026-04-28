import * as Sentry from '@sentry/sveltekit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';
import { registerPdfBrowserShutdown } from '$lib/server/pdf';

const sentryDsn = process.env.SENTRY_DSN ?? process.env.PUBLIC_SENTRY_DSN;

registerPdfBrowserShutdown();

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

function serializeCause(cause: unknown): Record<string, unknown> | string | undefined {
	if (!cause) return undefined;
	if (cause instanceof Error) {
		return {
			name: cause.name,
			message: cause.message,
			stack: cause.stack,
			...(cause as unknown as Record<string, unknown>)
		};
	}
	if (typeof cause === 'object') {
		try {
			return JSON.parse(JSON.stringify(cause));
		} catch {
			return String(cause);
		}
	}
	return String(cause);
}

const serverHandleError: HandleServerError = ({ error, event, status, message }) => {
	const err = error as { name?: string; message?: string; stack?: string; cause?: unknown };
	const cause = serializeCause(err?.cause);

	console.error('[handleError]', {
		url: event.url.pathname,
		status,
		message: err?.message ?? message,
		stack: err?.stack,
		cause
	});

	// Enrich the Sentry event with the real cause (Drizzle/Postgres errors
	// usually carry the useful detail in `error.cause`, not in `error.message`).
	if (sentryDsn) {
		Sentry.withScope((scope) => {
			scope.setTag('server_error_path', event.url.pathname);
			scope.setContext('request', {
				url: event.url.href,
				method: event.request.method,
				status
			});
			if (cause)
				scope.setContext('error_cause', typeof cause === 'string' ? { value: cause } : cause);
			Sentry.captureException(error);
		});
	}

	// La app es interna así que devolvemos el mensaje real al cliente.
	const detail =
		typeof cause === 'object' && cause && 'message' in cause
			? String((cause as { message?: unknown }).message ?? '')
			: typeof cause === 'string'
				? cause
				: '';
	return {
		message: err?.message ? (detail ? `${err.message}: ${detail}` : err.message) : 'Internal Error'
	};
};

export const handleError = sentryDsn
	? Sentry.handleErrorWithSentry(serverHandleError)
	: serverHandleError;

export const handle: Handle = sentryDsn ? sequence(Sentry.sentryHandle(), handleAuth) : handleAuth;
