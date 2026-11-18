import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuoteAuditHistoryDrawer from './QuoteAuditHistoryDrawer.svelte';
import type { QuoteAuditEvent } from './quoteAudit';

const events: QuoteAuditEvent[] = [
	{
		id: 'e1',
		title: 'Presupuesto creado',
		detail: null,
		changedAt: '2026-11-14T11:48:00.000Z',
		changedByName: 'Optikt Admin',
		tone: 'navy',
		icon: 'plus'
	}
];

test('cierra avisando al padre (para poder reabrir el historial)', async () => {
	const onclose = vi.fn();
	const screen = await render(QuoteAuditHistoryDrawer, { props: { open: true, events, onclose } });
	await expect.element(screen.getByText('Historial del presupuesto')).toBeVisible();

	await screen.getByRole('button', { name: 'Cerrar historial' }).click();
	expect(onclose).toHaveBeenCalledTimes(1);
});
