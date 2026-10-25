import { describe, expect, it, vi } from 'vitest';

const { startExchangeRatesPoller } = vi.hoisted(() => ({
	startExchangeRatesPoller: vi.fn()
}));

vi.mock('$lib/server/exchangeRates/poller', () => ({
	startExchangeRatesPoller
}));

import { init } from './hooks.server';

describe('server init hook', () => {
	it('starts the exchange rates poller when the server boots', () => {
		init();
		expect(startExchangeRatesPoller).toHaveBeenCalledTimes(1);
	});
});
