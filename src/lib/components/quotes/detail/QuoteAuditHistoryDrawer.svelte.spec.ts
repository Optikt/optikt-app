import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuoteAuditHistoryDrawer from './QuoteAuditHistoryDrawer.svelte';
import { classifyQuoteAuditEntry } from './quoteAudit';
import type { AuditEvent } from '$lib/utils/saleDetail';

const CTX = {
	sourceQuoteNumber: null,
	convertedOrderNumber: null,
	quoteIsCashea: false,
	createdWithoutCustomer: false
};

const diff = {
	v: 1,
	items: [{ t: 'add', name: 'Montura X', qty: 1, unitPrice: 20, total: 20 }],
	header: [],
	totals: [{ label: 'Total', from: 100, to: 120 }]
};

const events = [
	classifyQuoteAuditEntry(
		{
			id: 'e-edit',
			action: 'update',
			changes: { total: { old: 100, new: 120 }, itemsDiff: { old: null, new: diff } } as never,
			changedAt: '2026-11-15T11:48:00.000Z',
			changedByName: 'Optikt Admin'
		},
		CTX
	),
	classifyQuoteAuditEntry(
		{
			id: 'e1',
			action: 'create',
			changes: null,
			changedAt: '2026-11-14T11:48:00.000Z',
			changedByName: 'Optikt Admin'
		},
		CTX
	)
].filter((e): e is AuditEvent => e !== null);

test('muestra el detalle de la edición como ventas (artículos y totales)', async () => {
	const screen = await render(QuoteAuditHistoryDrawer, {
		props: {
			open: true,
			events,
			onclose: () => {},
			createdAt: '2026-11-14T11:48:00.000Z',
			expandedEventId: 'e-edit'
		}
	});
	await expect.element(screen.getByText('Historial de cambios')).toBeVisible();
	await expect.element(screen.getByText('Presupuesto editado')).toBeVisible();
	await expect.element(screen.getByText('Montura X')).toBeVisible();
});

test('cierra avisando al padre (para poder reabrir el historial)', async () => {
	const onclose = vi.fn();
	const screen = await render(QuoteAuditHistoryDrawer, {
		props: { open: true, events, onclose, createdAt: '2026-11-14T11:48:00.000Z' }
	});
	await expect.element(screen.getByText('Historial de cambios')).toBeVisible();

	await screen.getByRole('button', { name: 'Cerrar' }).click();
	expect(onclose).toHaveBeenCalledTimes(1);
});
