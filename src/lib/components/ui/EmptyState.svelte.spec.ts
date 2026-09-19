import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EmptyState from './EmptyState.svelte';

test('renders the message with the default status role', async () => {
	const screen = await render(EmptyState, { message: 'Sin resultados' });

	await expect.element(screen.getByText('Sin resultados')).toBeVisible();
	await expect.element(screen.getByRole('status')).toHaveAttribute('aria-label', 'Sin contenido');
});

test('accepts a custom aria label', async () => {
	const screen = await render(EmptyState, { message: 'Nada por aquí', ariaLabel: 'Lista vacía' });

	await expect.element(screen.getByRole('status')).toHaveAttribute('aria-label', 'Lista vacía');
});
