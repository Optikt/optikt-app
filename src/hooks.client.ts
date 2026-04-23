import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';
import { reportClientError } from '$lib/utils';

const sentryDsn = env.PUBLIC_SENTRY_DSN;

if (sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		environment: env.PUBLIC_SENTRY_ENVIRONMENT || undefined,
		release: __APP_VERSION__,

		// Capture 100% of errors; sample 20% of transactions for perf context.
		tracesSampleRate: 0.2,

		// Session Replay: record 30% of sessions normally, 100% of sessions
		// that include an error. This is the key tool for catching the
		// intermittent freezes that leave no trace in logs.
		replaysSessionSampleRate: 0.3,
		replaysOnErrorSampleRate: 1.0,

		integrations: [
			Sentry.replayIntegration({
				// Keep PII minimal but readable enough to see what happened.
				maskAllText: false,
				maskAllInputs: true,
				blockAllMedia: false,
				networkDetailAllowUrls: [window.location.origin]
			}),
			// Any console.warn / console.error becomes a Sentry breadcrumb and,
			// for "error", an actual Sentry event. Svelte 5 reports most of its
			// runtime issues (effect_update_depth_exceeded, state_unsafe_mutation,
			// ownership_invalid_mutation, etc.) through console — this surfaces
			// them even when nothing is thrown.
			Sentry.captureConsoleIntegration({ levels: ['warn', 'error'] }),
			// Breadcrumbs for every fetch/XHR so we can see hung requests in replays.
			Sentry.breadcrumbsIntegration({ fetch: true, xhr: true, console: true })
		]
	});

	// Heartbeat: record when the tab goes to background / comes back. Freezes
	// that happen "after leaving the tab idle" leave a distinctive breadcrumb.
	if (typeof document !== 'undefined') {
		let hiddenAt: number | null = null;
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				hiddenAt = Date.now();
				Sentry.addBreadcrumb({
					category: 'lifecycle',
					level: 'info',
					message: 'tab hidden',
					data: { url: window.location.href }
				});
			} else {
				const awayMs = hiddenAt ? Date.now() - hiddenAt : null;
				hiddenAt = null;
				Sentry.addBreadcrumb({
					category: 'lifecycle',
					level: 'info',
					message: 'tab visible',
					data: { url: window.location.href, awayMs }
				});
			}
		});
	}
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
