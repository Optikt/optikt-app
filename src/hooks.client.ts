import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';
import { reportClientError } from '$lib/utils';

const sentryDsn = env.PUBLIC_SENTRY_DSN;

if (sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		environment: env.PUBLIC_SENTRY_ENVIRONMENT || undefined,
		release: __APP_VERSION__
	});
}

const clientHandleError: HandleClientError = ({ error, event, status, message }) => {
	reportClientError('hooks.client', error, {
		status,
		message,
		url: event.url.href
	});

	return { message };
};

export const handleError = sentryDsn
	? Sentry.handleErrorWithSentry(clientHandleError)
	: clientHandleError;
