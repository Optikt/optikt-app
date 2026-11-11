import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'svelte-sonner';

import type { CountLineRow } from '$lib/server/db/queries/inventoryCount/types';
import { AdjustmentReason } from '$lib/shared/enums';

const requestLineAdjustmentCmd = vi.fn();
const requestAdjustmentsBatchCmd = vi.fn();
const clearLineAdjustmentCmd = vi.fn();
const loggerError = vi.fn();

vi.mock('$lib/remote/inventoryCount.remote', () => ({
	requestLineAdjustmentCmd: (...args: unknown[]) => requestLineAdjustmentCmd(...args),
	requestAdjustmentsBatchCmd: (...args: unknown[]) => requestAdjustmentsBatchCmd(...args),
	clearLineAdjustmentCmd: (...args: unknown[]) => clearLineAdjustmentCmd(...args)
}));
vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}));
vi.mock('$lib/utils/logger', () => ({
	logger: {
		error: (...args: unknown[]) => loggerError(...args),
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

import { createAdjustmentActions } from './adjustmentActions';

const line = { id: 3 } as CountLineRow;
const okLine = { id: 3, adjustmentRequestedAt: '2026-11-11T00:00:00Z' } as unknown as CountLineRow;

function makeActions(options: Partial<Parameters<typeof createAdjustmentActions>[0]> = {}): {
	actions: ReturnType<typeof createAdjustmentActions>;
	replaceLine: ReturnType<typeof vi.fn>;
	refreshLines: ReturnType<typeof vi.fn>;
	closeDrawer: ReturnType<typeof vi.fn>;
	isBusy: () => boolean;
	setBusyCalls: boolean[];
} {
	const replaceLine = vi.fn();
	const refreshLines = vi.fn().mockResolvedValue(undefined);
	const closeDrawer = vi.fn();
	let busy = false;
	const setBusyCalls: boolean[] = [];
	const actions = createAdjustmentActions({
		sessionId: 7,
		getReason: () => ({ reason: AdjustmentReason.PHYSICAL_COUNT, reasonText: '' }),
		replaceLine,
		refreshLines,
		closeDrawer,
		isBusy: () => busy,
		setBusy: (value) => {
			busy = value;
			setBusyCalls.push(value);
		},
		...options
	});
	return { actions, replaceLine, refreshLines, closeDrawer, isBusy: () => busy, setBusyCalls };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('createAdjustmentActions.requestAdjust', () => {
	it('solicita, reemplaza la línea, cierra el drawer y marca el éxito', async () => {
		const { actions, replaceLine, closeDrawer, isBusy } = makeActions();
		requestLineAdjustmentCmd.mockResolvedValue({ success: true, data: okLine });

		await actions.requestAdjust(line);

		expect(requestLineAdjustmentCmd).toHaveBeenCalledWith({
			lineId: 3,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null
		});
		expect(replaceLine).toHaveBeenCalledWith(okLine);
		expect(closeDrawer).toHaveBeenCalledTimes(1);
		expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('listo para el cierre'));
		expect(isBusy()).toBe(false);
	});

	it('rechaza motivo «Otros» sin texto antes de llamar al server', async () => {
		const { actions, replaceLine } = makeActions({
			getReason: () => ({ reason: AdjustmentReason.OTHER, reasonText: '   ' })
		});

		await actions.requestAdjust(line);

		expect(requestLineAdjustmentCmd).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith('Escribe el motivo');
		expect(replaceLine).not.toHaveBeenCalled();
	});

	it('no dispara si ya hay una acción en vuelo', async () => {
		const { actions } = makeActions({ isBusy: () => true });

		await actions.requestAdjust(line);

		expect(requestLineAdjustmentCmd).not.toHaveBeenCalled();
	});

	it('falla el server → toast de error y sin cierre', async () => {
		const { actions, closeDrawer, replaceLine, isBusy } = makeActions();
		requestLineAdjustmentCmd.mockResolvedValue({
			success: false,
			error: 'La sesión ya no está abierta'
		});

		await actions.requestAdjust(line);

		expect(toast.error).toHaveBeenCalledWith('La sesión ya no está abierta');
		expect(closeDrawer).not.toHaveBeenCalled();
		expect(replaceLine).not.toHaveBeenCalled();
		expect(isBusy()).toBe(false);
	});

	it('excepción → logger + toast y el busy se libera', async () => {
		const { actions, isBusy } = makeActions();
		requestLineAdjustmentCmd.mockRejectedValue(new Error('red caída'));

		await actions.requestAdjust(line);

		expect(loggerError).toHaveBeenCalledTimes(1);
		expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('red caída'));
		expect(isBusy()).toBe(false);
	});
});

describe('createAdjustmentActions.requestBatch', () => {
	it('marca el lote, recarga líneas y cierra el drawer', async () => {
		const { actions, refreshLines, closeDrawer, isBusy } = makeActions();
		requestAdjustmentsBatchCmd.mockResolvedValue({ success: true, data: 2 });

		await actions.requestBatch();

		expect(requestAdjustmentsBatchCmd).toHaveBeenCalledWith({
			sessionId: 7,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null
		});
		expect(refreshLines).toHaveBeenCalledTimes(1);
		expect(closeDrawer).toHaveBeenCalledTimes(1);
		expect(toast.success).toHaveBeenCalledWith('2 ajuste(s) listos para el cierre');
		expect(isBusy()).toBe(false);
	});

	it('motivo inválido → no llama al server', async () => {
		const { actions, refreshLines } = makeActions({
			getReason: () => ({ reason: AdjustmentReason.OTHER, reasonText: '' })
		});

		await actions.requestBatch();

		expect(requestAdjustmentsBatchCmd).not.toHaveBeenCalled();
		expect(refreshLines).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith('Escribe el motivo');
	});
});

describe('createAdjustmentActions.clearAdjust', () => {
	it('quita la solicitud, reemplaza la línea y confirma', async () => {
		const { actions, replaceLine, isBusy } = makeActions();
		clearLineAdjustmentCmd.mockResolvedValue({ success: true, data: okLine });

		await actions.clearAdjust(line);

		expect(clearLineAdjustmentCmd).toHaveBeenCalledWith({ lineId: 3 });
		expect(replaceLine).toHaveBeenCalledWith(okLine);
		expect(toast.success).toHaveBeenCalledWith('Ajuste quitado');
		expect(isBusy()).toBe(false);
	});

	it('falla el server → toast de error', async () => {
		const { actions, replaceLine } = makeActions();
		clearLineAdjustmentCmd.mockResolvedValue({ success: false, error: 'Sin ajuste solicitado' });

		await actions.clearAdjust(line);

		expect(toast.error).toHaveBeenCalledWith('Sin ajuste solicitado');
		expect(replaceLine).not.toHaveBeenCalled();
	});

	it('excepción → logger + toast y el busy se libera', async () => {
		const { actions, isBusy } = makeActions();
		clearLineAdjustmentCmd.mockRejectedValue(new Error('timeout'));

		await actions.clearAdjust(line);

		expect(loggerError).toHaveBeenCalledTimes(1);
		expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('timeout'));
		expect(isBusy()).toBe(false);
	});
});
