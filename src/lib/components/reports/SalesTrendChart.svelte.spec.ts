import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SalesTrendChart from './SalesTrendChart.svelte';

const points = [
	{ date: '2026-09-01', total: 100, paid: 40 },
	{ date: '2026-09-02', total: 60, paid: 60 }
];

test('renders the empty state without points', async () => {
	const screen = await render(SalesTrendChart, { points: [] });

	await expect.element(screen.getByText('No hay ventas en el período seleccionado')).toBeVisible();
	expect(screen.container.querySelector('svg')).toBeNull();
});

test('renders the trend chart with points', async () => {
	const screen = await render(SalesTrendChart, { points });

	expect(screen.container.querySelector('svg')).not.toBeNull();
});
