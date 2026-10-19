import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { EditableItem, EditLensTreatment } from '../editSaleDraft';
import {
	editableItemFromLensEditorDraft,
	editTreatmentsFromLensEditor,
	lensEditorDraftFromEditableItem,
	lensEditorTreatmentsFromEdit
} from './editSaleLensAdapter';

function item(overrides: Partial<EditableItem> = {}): EditableItem {
	return {
		id: 'item-1',
		itemType: SaleItemType.LENS_PAIR,
		lensCatalogItemId: 'lens-1',
		quantity: 1,
		unitPrice: 40,
		discount: 5,
		discountType: DiscountType.FIXED,
		snapshotName: 'Lente',
		snapshotBrand: 'Proveedor',
		snapshotBaseCost: 10,
		...overrides
	};
}

const treatment: EditLensTreatment = {
	supplierTreatmentId: 't-1',
	name: 'AR',
	price: 4,
	salePrice: 8,
	isTaxable: true,
	category: 'COAT',
	_keep: true
};

describe('lensEditorDraftFromEditableItem', () => {
	it('maps the sale draft to the shared lens draft', () => {
		const draft = lensEditorDraftFromEditableItem(
			item({
				odSphere: -2,
				odCylinder: -0.5,
				odAxis: 90
			}),
			[treatment]
		);

		expect(draft).toMatchObject({
			lensCatalogItemId: 'lens-1',
			quantity: 1,
			unitPrice: 40,
			discount: 5,
			discountType: DiscountType.FIXED
		});
		expect(draft.od).toEqual({
			sphere: -2,
			cylinder: -0.5,
			axis: 90,
			addition: null,
			altura: null
		});
		expect(draft.oi.sphere).toBeNull();
		expect(draft.treatments).toHaveLength(1);
	});
});

describe('editableItemFromLensEditorDraft', () => {
	it('writes draft values back into the sale item, preserving snapshots', () => {
		const base = item();
		const draft = lensEditorDraftFromEditableItem(base);
		draft.lensCatalogItemId = 'lens-2';
		draft.unitPrice = 55;
		draft.od = { sphere: 1.25, cylinder: -1, axis: 180, addition: 2, altura: 18 };
		draft.oi = { sphere: null, cylinder: null, axis: null, addition: null, altura: null };

		const result = editableItemFromLensEditorDraft(base, draft);

		expect(result).toMatchObject({
			id: 'item-1',
			itemType: SaleItemType.LENS_PAIR,
			lensCatalogItemId: 'lens-2',
			unitPrice: 55,
			snapshotName: 'Lente',
			snapshotBrand: 'Proveedor',
			odSphere: 1.25,
			odCylinder: -1,
			odAxis: 180,
			odAddition: 2,
			odAltura: 18
		});
		expect(result.osSphere).toBeUndefined();
	});
});

describe('treatment adapters', () => {
	it('round-trips edit treatments through the shared shape', () => {
		const shared = lensEditorTreatmentsFromEdit([treatment]);
		expect(shared[0]).toEqual({
			supplierTreatmentId: 't-1',
			name: 'AR',
			price: 4,
			salePrice: 8,
			isTaxable: true,
			category: 'COAT'
		});

		const back = editTreatmentsFromLensEditor(shared);
		expect(back[0]).toMatchObject({
			supplierTreatmentId: 't-1',
			name: 'AR',
			price: 4,
			salePrice: 8,
			isTaxable: true,
			category: 'COAT',
			_keep: true
		});
	});
});
