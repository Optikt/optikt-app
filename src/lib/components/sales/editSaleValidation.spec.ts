import { describe, expect, it } from 'vitest';
import { DiscountType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { validateActiveItemsNotEmpty, validateEditSale } from './editSaleValidation';
import type { EditableItem } from './editSaleDraft';

const item: EditableItem = {
	itemType: SaleItemType.PRODUCT,
	quantity: 1,
	unitPrice: 100,
	discount: 0,
	discountType: DiscountType.FIXED,
	id: '1'
};

describe('validateEditSale', () => {
	it('requires a reason', () => {
		expect(validateEditSale('   ', [item])).toEqual({
			valid: false,
			reasonError: 'El motivo de la modificación es obligatorio'
		});
	});

	it('rejects empty item lists', () => {
		expect(validateEditSale('Corrección', [])).toEqual({ valid: false, reasonError: '' });
	});

	it('accepts reason with items', () => {
		expect(validateEditSale('Corrección', [item])).toEqual({
			valid: true,
			reasonError: ''
		});
	});
});

describe('validateActiveItemsNotEmpty', () => {
	it('returns message only when empty', () => {
		expect(validateActiveItemsNotEmpty([])).toBe('La venta debe tener al menos un artículo');
		expect(validateActiveItemsNotEmpty([item])).toBeNull();
	});
});
