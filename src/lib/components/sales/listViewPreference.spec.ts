import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveUserPreference = vi.fn();
const toastSuccess = vi.fn();

vi.mock('$lib/remote/users/preferences.remote', () => ({
	saveUserPreference: (...args: unknown[]) => saveUserPreference(...args)
}));
vi.mock('svelte-sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));
vi.mock('$lib/utils/logger', () => ({ logger: { error: vi.fn() } }));

const { persistListView, LIST_VIEW_PREFERENCE_KEY, LIST_VIEW_RETRY_MS } =
	await import('./listViewPreference');

describe('persistListView', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		saveUserPreference.mockReset();
		toastSuccess.mockReset();
	});
	afterEach(() => vi.useRealTimers());

	it('guarda en la llave compartida ventas/presupuestos y avisa', async () => {
		saveUserPreference.mockResolvedValue(undefined);
		await expect(persistListView('grid')).resolves.toBe(true);
		expect(LIST_VIEW_PREFERENCE_KEY).toBe('sales.view');
		expect(saveUserPreference).toHaveBeenCalledWith({ key: 'sales.view', value: 'grid' });
		expect(toastSuccess).toHaveBeenCalledWith('Vista «Cuadros» guardada en tu perfil', {
			id: 'sales.view.toast'
		});
	});

	it('etiqueta «Lista»', async () => {
		saveUserPreference.mockResolvedValue(undefined);
		await persistListView('list');
		expect(toastSuccess.mock.calls[0][0]).toContain('«Lista»');
	});

	it('si falla: sin toast y reintento silencioso', async () => {
		saveUserPreference.mockRejectedValueOnce(new Error('red')).mockResolvedValue(undefined);
		await expect(persistListView('list')).resolves.toBe(false);
		expect(toastSuccess).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(LIST_VIEW_RETRY_MS);
		expect(saveUserPreference).toHaveBeenCalledTimes(2);
	});
});
