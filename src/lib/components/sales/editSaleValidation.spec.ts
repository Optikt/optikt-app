import { describe, expect, it } from 'vitest';
import { validateActiveItemsNotEmpty, validateEditSale } from './editSaleValidation';
import type { EditableItem } from './editSaleDraft';

describe('validateEditSale', () => {
	it('requires a reason', () => {
		expect(validateEditSale('   ', [{ id: 1 } as EditableItem])).toEqual({
			valid: false,
			reasonError: 'El motivo de la modificación es obligatorio'
		});
	});

	it('rejects empty item lists', () => {
		expect(validateEditSale('Corrección', [])).toEqual({ valid: false, reasonError: '' });
	});

	it('accepts reason with items', () => {
		expect(validateEditSale('Corrección', [{ id: 1 } as EditableItem])).toEqual({
			valid: true,
			reasonError: ''
		});
	});
});

describe('validateActiveItemsNotEmpty', () => {
	it('returns message only when empty', () => {
		expect(validateActiveItemsNotEmpty([])).toBe('La venta debe tener al menos un artículo');
		expect(validateActiveItemsNotEmpty([{ id: 1 } as EditableItem])).toBeNull();
	});
});
