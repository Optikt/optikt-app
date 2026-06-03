import * as Sentry from '@sentry/sveltekit';
import { startExchangeRatesPoller } from '$lib/server/exchangeRates/poller';

const sentryDsn = process.env.SENTRY_DSN ?? process.env.PUBLIC_SENTRY_DSN;

if (sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
		release: process.env.SENTRY_RELEASE ?? __APP_VERSION__
	});
}

startExchangeRatesPoller();
