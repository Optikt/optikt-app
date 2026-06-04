import { describe, expect, it } from 'vitest';
import { resolveExchangeRatesTransition } from './health';

describe('resolveExchangeRatesTransition', () => {
	it('detects a transition from healthy to stale', () => {
		expect(resolveExchangeRatesTransition(false, { isStale: true })).toBe('became_stale');
	});

	it('detects a transition from stale to healthy', () => {
		expect(resolveExchangeRatesTransition(true, { isStale: false })).toBe('recovered');
	});

	it('does not report a transition when the stale state is unchanged', () => {
		expect(resolveExchangeRatesTransition(false, { isStale: false })).toBeNull();
		expect(resolveExchangeRatesTransition(true, { isStale: true })).toBeNull();
	});
});
