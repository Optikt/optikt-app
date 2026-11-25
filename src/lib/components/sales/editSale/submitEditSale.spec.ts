import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const updateSale = vi.fn();
const updateExistingQuote = vi.fn();

vi.mock('svelte-sonner', () => ({
	toast: {
		success: (...a: unknown[]) => toastSuccess(...a),
		error: (...a: unknown[]) => toastError(...a)
	}
}));
vi.mock('$lib/remote/sales/update.remote', () => ({ updateSale: (p: unknown) => updateSale(p) }));
vi.mock('$lib/remote/quotes/commands.remote', () => ({
	updateExistingQuote: (p: unknown) => updateExistingQuote(p)
}));
vi.mock('$lib/utils', () => ({
	logger: { error: vi.fn() },
	getErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
}));
vi.mock('$lib/components/quotes/editQuote/quoteEditAdapter', () => ({
	buildQuoteUpdatePayload: () => ({ id: 'q-1', items: [] })
}));
vi.mock('../editSaleDraft', () => ({ buildUpdateSalePayload: () => ({ id: 's-1' }) }));

const { buildEditSubmitInput, submitEditSale } = await import('./submitEditSale');

const quoteInput = { mode: 'quote', quote: {}, draft: {} } as never;
const saleInput = { mode: 'sale', sale: {}, originalItems: [], draft: {} } as never;

beforeEach(() => {
	for (const fn of [toastSuccess, toastError, updateSale, updateExistingQuote]) fn.mockReset();
});

describe('submitEditSale · presupuesto', () => {
	it('éxito → toast y null', async () => {
		updateExistingQuote.mockResolvedValue({ success: true });
		await expect(submitEditSale(quoteInput)).resolves.toBeNull();
		expect(updateExistingQuote).toHaveBeenCalledWith({ id: 'q-1', items: [] });
		expect(toastSuccess).toHaveBeenCalledWith('Presupuesto actualizado');
	});

	it('error del comando o excepción → mensaje notificado', async () => {
		updateExistingQuote.mockResolvedValueOnce({ success: false, error: 'Solo borradores' });
		await expect(submitEditSale(quoteInput)).resolves.toBe('Solo borradores');
		updateExistingQuote.mockResolvedValueOnce({ success: false });
		await expect(submitEditSale(quoteInput)).resolves.toBe('Error actualizando presupuesto');
		updateExistingQuote.mockRejectedValueOnce(new Error('red caída'));
		await expect(submitEditSale(quoteInput)).resolves.toBe('red caída');
		expect(toastError).toHaveBeenCalledTimes(3);
	});
});

describe('submitEditSale · venta', () => {
	it('éxito → toast y null', async () => {
		updateSale.mockResolvedValue({ success: true });
		await expect(submitEditSale(saleInput)).resolves.toBeNull();
		expect(toastSuccess).toHaveBeenCalledWith('Venta actualizada');
	});

	it('error del comando o excepción → mensaje notificado', async () => {
		updateSale.mockResolvedValueOnce({ success: false, error: 'Stock insuficiente' });
		await expect(submitEditSale(saleInput)).resolves.toBe('Stock insuficiente');
		updateSale.mockResolvedValueOnce({ success: false });
		await expect(submitEditSale(saleInput)).resolves.toBe('Error actualizando venta');
		updateSale.mockRejectedValueOnce(new Error('timeout'));
		await expect(submitEditSale(saleInput)).resolves.toBe('timeout');
	});

	it('reenvía groupsPatch en venta y presupuesto', async () => {
		const groups = [{ label: 'Ana', members: [{ itemId: 'i-1', quantity: 1 }] }];
		updateExistingQuote.mockResolvedValueOnce({ success: true });
		await submitEditSale({
			...(quoteInput as object),
			groupsPatch: { groups }
		} as never);
		expect(updateExistingQuote).toHaveBeenCalledWith({ id: 'q-1', items: [], groups });

		updateSale.mockResolvedValueOnce({ success: true });
		await submitEditSale({
			...(saleInput as object),
			groupsPatch: { groups, primaryLensItemId: 'l-1' }
		} as never);
		expect(updateSale).toHaveBeenCalledWith({ id: 's-1', groups, primaryLensItemId: 'l-1' });
	});
});

describe('buildEditSubmitInput', () => {
	const base = {
		items: [],
		editableItems: [],
		activeItems: [],
		removedCount: 0,
		saleDate: '2026-11-24',
		validUntil: '2026-12-01',
		notes: 'nota',
		isCashea: false,
		discount: 5,
		discountType: 'FIXED',
		reason: 'ajuste',
		prescription: { dp: 62, npRight: 31, npLeft: 31 },
		measures: { odDp: 63, odDnp: 31.5, osDnp: 31.5 },
		groupsPatch: {}
	};

	it('arma input de presupuesto cuando viene quote', () => {
		const out = buildEditSubmitInput({ ...base, quote: { id: 'q-1' } as never });
		expect(out.mode).toBe('quote');
		if (out.mode === 'quote') {
			expect(out.draft.dateIso).toBe('2026-11-24');
			expect(out.draft.validUntilIso).toBe('2026-12-01');
		}
	});

	it('arma input de venta con y sin fórmula', () => {
		const withRx = buildEditSubmitInput({ ...base, sale: { id: 's-1' } as never });
		expect(withRx.mode).toBe('sale');
		if (withRx.mode === 'sale') {
			expect(withRx.draft.prescription).toEqual({ dp: 62, npRight: 31, npLeft: 31 });
			expect(withRx.draft.prescriptionPatch).toEqual({ dp: 63, npRight: 31.5, npLeft: 31.5 });
		}

		const noRx = buildEditSubmitInput({
			...base,
			sale: { id: 's-1' } as never,
			prescription: null
		});
		if (noRx.mode === 'sale') expect(noRx.draft.prescription).toBeNull();
	});
});
