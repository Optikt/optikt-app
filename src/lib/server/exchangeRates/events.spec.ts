import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	SSE_MAX_LISTENERS,
	clearSseListeners,
	emitRatesUpdated,
	getSseListenerCount,
	hasSseCapacity,
	onRatesUpdated,
	stopSseSweeper,
	touchListener
} from './events';
import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';

function snapshot(): ExchangeRatesSnapshot {
	return {
		rates: [],
		isStale: false,
		lastFetchedAt: new Date().toISOString()
	} as unknown as ExchangeRatesSnapshot;
}

function connect(cid: string): { send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } {
	const send = vi.fn();
	const close = vi.fn();
	onRatesUpdated(cid, send, close, null);
	return { send, close };
}

describe('exchangeRates events registry', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
		clearSseListeners();
	});

	afterEach(() => {
		stopSseSweeper();
		vi.useRealTimers();
	});

	it('tracks connections by cid and counts them', () => {
		connect('a');
		connect('b');
		expect(getSseListenerCount()).toBe(2);
	});

	it('a same-cid reconnect replaces the entry instead of growing the registry', () => {
		const first = connect('a');
		const second = connect('a');
		expect(getSseListenerCount()).toBe(1);

		emitRatesUpdated(snapshot());
		// The old stream is replaced: only the newest send gets the emit.
		expect(first.send).not.toHaveBeenCalled();
		expect(second.send).toHaveBeenCalledTimes(1);
	});

	it('emits to every listener and marks them alive', () => {
		const a = connect('a');
		const b = connect('b');
		emitRatesUpdated(snapshot());
		expect(a.send).toHaveBeenCalledTimes(1);
		expect(b.send).toHaveBeenCalledTimes(1);
	});

	it('prunes entries that throw on send and closes their stream', () => {
		const dead = connect('dead');
		dead.send.mockImplementation(() => {
			throw new Error('controller closed');
		});
		connect('alive');
		emitRatesUpdated(snapshot());
		expect(getSseListenerCount()).toBe(1);
		expect(dead.close).toHaveBeenCalled();
	});

	it('sweeps idle listeners after the timeout and closes their stream', () => {
		const idle = connect('idle');
		connect('fresh');
		// fresh keeps pinging: touch mid-flight so it never crosses the idle window.
		vi.advanceTimersByTime(60_000);
		touchListener('fresh');
		vi.advanceTimersByTime(61_000);
		expect(getSseListenerCount()).toBe(1);
		expect(idle.close).toHaveBeenCalled();
	});

	it('touched listeners survive the sweep', () => {
		const a = connect('a');
		// 60s elapsed (still alive), touch, another 60s — under the 90s idle window.
		vi.advanceTimersByTime(60_000);
		touchListener('a');
		vi.advanceTimersByTime(60_000);
		expect(getSseListenerCount()).toBe(1);
		expect(a.close).not.toHaveBeenCalled();
		// 120s without any touch → swept.
		vi.advanceTimersByTime(121_000);
		expect(getSseListenerCount()).toBe(0);
		expect(a.close).toHaveBeenCalled();
	});

	it('unsubscribes removes the listener without closing the stream', () => {
		const send = vi.fn<(s: ExchangeRatesSnapshot) => void>();
		const close = vi.fn();
		const un = onRatesUpdated('a', send, close, null);
		un();
		expect(getSseListenerCount()).toBe(0);
		expect(close).not.toHaveBeenCalled();
	});

	it('capacity is refused only for new cids at the cap', () => {
		for (let i = 0; i < SSE_MAX_LISTENERS; i++) {
			connect(`cid-${i}`);
		}
		expect(hasSseCapacity('cid-0')).toBe(true);
		expect(hasSseCapacity('cid-new')).toBe(false);
	});
});
