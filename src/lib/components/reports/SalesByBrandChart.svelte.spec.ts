import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SalesByBrandChart from './SalesByBrandChart.svelte';

const slices = [
	{ brand: 'Ray-Ban', total: 280, salesCount: 2 },
	{ brand: 'Oakley', total: 45, salesCount: 1 }
];

test('renders the empty state without slices', async () => {
	const screen = await render(SalesByBrandChart, { slices: [] });

	await expect
		.element(screen.getByText('No hay ventas de monturas o lentes de sol en el período'))
		.toBeVisible();
	expect(screen.container.querySelector('svg')).toBeNull();
});

test('renders the brand chart with slices', async () => {
	const screen = await render(SalesByBrandChart, { slices });

	expect(screen.container.querySelector('svg')).not.toBeNull();
});
