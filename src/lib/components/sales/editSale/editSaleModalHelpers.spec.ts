import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditableItem } from '../editSaleDraft';

const toastError = vi.fn();
const loggerError = vi.fn();
const seedCatalog = vi.fn();

vi.mock('svelte-sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
vi.mock('$lib/utils', () => ({ logger: { error: (...a: unknown[]) => loggerError(...a) } }));
vi.mock('../editSaleDraft', () => ({
	seedCatalogCacheForItems: (...a: unknown[]) => seedCatalog(...a)
}));

const {
	EMPTY_MEASURES,
	measuresChanged,
	measuresFromSeed,
	removeEditableChild,
	removeEditableItem,
	restoreEditableItem,
	seedCatalogCacheLogged,
	validateEditModal
} = await import('./editSaleModalHelpers');

function item(partial: Partial<EditableItem>): EditableItem {
	return { itemType: 'PRODUCT', _removed: false, ...partial } as EditableItem;
}

beforeEach(() => {
	toastError.mockReset();
	loggerError.mockReset();
	seedCatalog.mockReset();
});

describe('medidas de montaje', () => {
	it('seed → medidas (DP compartida, DNP por ojo) y vacío sin seed', () => {
		expect(measuresFromSeed({ dp: 62, npRight: 31, npLeft: 30 })).toEqual({
			odDp: 62,
			osDp: 62,
			odDnp: 31,
			osDnp: 30
		});
		expect(measuresFromSeed(null)).toEqual(EMPTY_MEASURES);
	});

	it('detecta cambios contra el seed', () => {
		const seed = { dp: 62, npRight: 31, npLeft: 30 };
		expect(measuresChanged(measuresFromSeed(seed), seed)).toBe(false);
		expect(measuresChanged({ ...measuresFromSeed(seed), osDnp: 29 }, seed)).toBe(true);
		expect(measuresChanged(EMPTY_MEASURES, null)).toBe(false);
	});
});

describe('alta/baja/restauración de ítems', () => {
	it('placeholder sin id desaparece', () => {
		const ph = item({ id: undefined });
		const other = item({ id: 'a' });
		expect(removeEditableItem([ph, other], ph)).toEqual([other]);
	});

	it('lente persistido: se marca con sus hijos y se restaura', () => {
		const lens = item({ id: 'lens', itemType: 'LENS_PAIR' });
		const child = item({ id: 't', itemType: 'TREATMENT', parentSaleItemId: 'lens' });
		const items = removeEditableItem([lens, child], lens);
		expect(items.every((i) => i._removed)).toBe(true);
		const restored = restoreEditableItem(items, lens);
		expect(restored.every((i) => !i._removed)).toBe(true);
	});

	it('producto persistido no toca a otros; hijo se quita solo', () => {
		const prod = item({ id: 'p' });
		const other = item({ id: 'o', parentSaleItemId: 'p' });
		removeEditableItem([prod, other], prod);
		expect(prod._removed).toBe(true);
		expect(other._removed).toBe(false);
		const child = item({ id: 'c' });
		expect(removeEditableChild([child], child)[0]._removed).toBe(true);
	});
});

describe('validateEditModal', () => {
	const base = { editingId: null, activeItems: [item({ id: 'a' })], reason: 'ajuste' };

	it('bloquea con un artículo abierto', () => {
		const r = validateEditModal({ ...base, editingId: 'x', mode: 'sale' });
		expect(r.valid).toBe(false);
		expect(toastError).toHaveBeenCalledWith('Termina de editar el artículo abierto con «Hecho ✓».');
	});

	it('presupuesto: exige al menos un artículo, sin motivo', () => {
		expect(validateEditModal({ ...base, mode: 'quote', reason: '' }).valid).toBe(true);
		const empty = validateEditModal({ ...base, mode: 'quote', activeItems: [] });
		expect(empty.valid).toBe(false);
		expect(toastError).toHaveBeenCalledWith('El presupuesto debe tener al menos un artículo');
	});

	it('venta: motivo obligatorio y al menos un artículo', () => {
		expect(validateEditModal({ ...base, mode: 'sale' }).valid).toBe(true);
		expect(validateEditModal({ ...base, mode: 'sale', reason: ' ' }).reasonError).not.toBe('');
		const empty = validateEditModal({ ...base, mode: 'sale', activeItems: [] });
		expect(empty.valid).toBe(false);
		expect(toastError).toHaveBeenCalledWith('La venta debe tener al menos un artículo');
	});
});

describe('seedCatalogCacheLogged', () => {
	it('un fallo solo se registra en el log', async () => {
		seedCatalog.mockRejectedValue(new Error('red'));
		seedCatalogCacheLogged([], 'quote');
		await vi.waitFor(() => expect(loggerError).toHaveBeenCalled());
		expect(loggerError.mock.calls[0][0]).toContain('quote');
	});
});
