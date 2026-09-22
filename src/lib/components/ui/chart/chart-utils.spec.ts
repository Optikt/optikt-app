import { describe, expect, it } from 'vitest';
import type { TooltipSeries } from 'layerchart';
import { THEMES, getPayloadConfigFromPayload, type ChartConfig } from './chart-utils';

function series(key: string, label: string): TooltipSeries {
	return { key, label, value: 1, visible: true, config: {} as TooltipSeries['config'] };
}

const config: ChartConfig = {
	total: { label: 'Vendido', color: 'var(--chart-1)' },
	paid: { label: 'Cobrado', color: 'var(--chart-2)' }
};

describe('getPayloadConfigFromPayload', () => {
	it('resolves an entry by series key', () => {
		expect(getPayloadConfigFromPayload(config, series('total', 'Vendido'), 'fallback')).toEqual({
			label: 'Vendido',
			color: 'var(--chart-1)'
		});
	});

	it('falls back to the provided key when the series key is unknown', () => {
		expect(getPayloadConfigFromPayload(config, series('unknown', 'X'), 'paid')?.label).toBe(
			'Cobrado'
		);
	});

	it('returns undefined for an unknown key', () => {
		expect(getPayloadConfigFromPayload(config, series('unknown', 'X'), 'nope')).toBeUndefined();
	});
});

describe('THEMES', () => {
	it('maps light to the default scope and dark to the dark class', () => {
		expect(THEMES.light).toBe('');
		expect(THEMES.dark).toBe('.dark');
	});
});
