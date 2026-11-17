import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SaleAuditHistoryDrawer from './SaleAuditHistoryDrawer.svelte';

function entry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'e1',
		entityType: 'sale',
		entityId: 'sale-1',
		action: 'create',
		changes: {},
		changedAt: '2026-11-07T11:48:00.000Z',
		changedByName: 'Optikt Admin',
		reason: null,
		...overrides
	} as never;
}

const diff = {
	v: 1,
	items: [{ t: 'add', name: 'Montura X', qty: 1, unitPrice: 20, total: 20 }],
	header: [],
	totals: [{ label: 'Total', from: 100, to: 120 }]
};

function entries() {
	return [
		entry({ id: 'e-create', action: 'create' }),
		entry({
			id: 'e-edit',
			action: 'update',
			changes: { total: { old: 100, new: 120 }, itemsDiff: { old: null, new: diff } }
		}),
		entry({
			id: 'e-pay',
			entityType: 'sale_payment',
			action: 'create',
			changes: { amountBcvUsd: { old: null, new: 45.5 } }
		}),
		entry({
			id: 'e-status',
			action: 'update',
			changes: { status: { old: 'PENDING', new: 'READY' } }
		}),
		entry({
			id: 'e-legacy',
			action: 'update',
			changes: { notes: { old: null, new: 'vieja' } }
		})
	];
}

async function openDrawer(expandedEventId: string | null = null) {
	const screen = await render(SaleAuditHistoryDrawer, {
		open: true,
		onclose: () => {},
		auditHistory: entries(),
		auditTotal: 5,
		saleId: 'sale-1',
		saleCreatedAt: '2026-11-07T11:48:00.000Z',
		saleCreatedBy: 'Optikt Admin',
		expandedEventId
	});
	// The SlideOver renders on open; wait for the header.
	await expect.element(screen.getByText('Historial de cambios')).toBeVisible();
	return screen;
}

test('filters split Todos / Ediciones / Estados', async () => {
	const screen = await openDrawer();
	const updated = () => screen.getByText('Venta actualizada');

	await expect.element(screen.getByText('Venta creada')).toBeVisible();
	await expect.element(updated().first()).toBeVisible();
	await expect.element(screen.getByText('Pago registrado')).toBeVisible();

	await screen.getByText(/Ediciones/).click();
	await expect.element(updated().first()).toBeVisible();
	await expect.element(screen.getByText('Pago registrado')).toBeVisible();
	expect(await screen.getByText('Venta creada').all()).toHaveLength(0);
	expect(await screen.getByText('Estado: Lista para Retirar').all()).toHaveLength(0);

	await screen.getByText(/Estados/).click();
	await expect.element(screen.getByText('Estado: Lista para Retirar')).toBeVisible();
	expect(await updated().all()).toHaveLength(0);

	await screen.getByText(/^Todos/).click();
	await expect.element(screen.getByText('Venta creada')).toBeVisible();
});

test('legacy updates show the notice instead of an expandable diff', async () => {
	const screen = await openDrawer();

	await expect
		.element(
			screen.getByText('Sin detalle de cambios registrado (evento anterior al registro detallado)')
		)
		.toBeVisible();
});

test('the linked event opens expanded', async () => {
	const screen = await openDrawer('e-edit');

	await expect.element(screen.getByText('Artículos')).toBeVisible();
	await expect.element(screen.getByText('Totales')).toBeVisible();
});
