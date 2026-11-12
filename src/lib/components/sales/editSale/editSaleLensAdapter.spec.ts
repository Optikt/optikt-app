import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import type { EditableItem, EditLensTreatment } from '../editSaleDraft';
import {
	collectLensRangeWarnings,
	editableItemFromLensEditorDraft,
	editTreatmentsFromLensEditor,
	filterCompatibleTreatments,
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
			enabled: true,
			sphere: -2,
			cylinder: -0.5,
			axis: 90,
			addition: null,
			altura: null,
			dp: null,
			dnp: null
		});
		expect(draft.oi.enabled).toBe(false);
		expect(draft.oi.sphere).toBeNull();
		expect(draft.treatments).toHaveLength(1);
	});

	it('seeds mounting measures from the item snapshot before the prescription fallback', () => {
		const measures = { odDp: 60, osDp: 60, odDnp: 30, osDnp: 30 };

		const fromItem = lensEditorDraftFromEditableItem(
			item({ dp: 62, npRight: 31, npLeft: 32 }),
			[],
			measures
		);
		expect(fromItem.od.dp).toBe(62);
		expect(fromItem.od.dnp).toBe(31);
		expect(fromItem.oi.dp).toBe(62);
		expect(fromItem.oi.dnp).toBe(32);

		const fallback = lensEditorDraftFromEditableItem(item(), [], measures);
		expect(fallback.od.dp).toBe(60);
		expect(fallback.od.dnp).toBe(30);
		expect(fallback.oi.dnp).toBe(30);
	});
});

describe('editableItemFromLensEditorDraft', () => {
	it('writes draft values back into the sale item, preserving snapshots', () => {
		const base = item();
		const draft = lensEditorDraftFromEditableItem(base);
		draft.lensCatalogItemId = 'lens-2';
		draft.unitPrice = 55;
		draft.od = {
			enabled: true,
			sphere: 1.25,
			cylinder: -1,
			axis: 180,
			addition: 2,
			altura: 18,
			dp: 61,
			dnp: 32
		};
		draft.oi = {
			enabled: false,
			sphere: 2,
			cylinder: null,
			axis: null,
			addition: null,
			altura: null,
			dp: null,
			dnp: null
		};

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
			odAltura: 18,
			dp: 61,
			npRight: 32
		});
		expect(result.osSphere).toBeUndefined();
		expect(result.npLeft).toBeUndefined();
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

describe('filterCompatibleTreatments', () => {
	it('drops treatments that do not belong to the selected lens supplier', () => {
		const other: EditLensTreatment = { ...treatment, supplierTreatmentId: 't-2', name: 'Blue' };

		const result = filterCompatibleTreatments(
			lensEditorTreatmentsFromEdit([treatment, other]),
			[{ id: 't-1' }],
			true
		);

		expect(result.map((item) => item.supplierTreatmentId)).toEqual(['t-1']);
	});

	it('keeps treatments untouched when the supplier is unknown', () => {
		const source = lensEditorTreatmentsFromEdit([treatment]);
		expect(filterCompatibleTreatments(source, [], false)).toEqual(source);
	});
});

describe('collectLensRangeWarnings', () => {
	const lens = {
		id: 'lens-1',
		ranges: [
			{
				sphereMin: -2,
				sphereMax: 2,
				cylinderMin: -2,
				cylinderMax: 0,
				additionMin: null,
				additionMax: null
			}
		]
	} as unknown as LensCatalogItemWithRelations;

	it('keys warnings by item id', () => {
		const result = collectLensRangeWarnings([item({ id: 'lens-item-1', odSphere: 4 })], (id) =>
			id === 'lens-1' ? lens : undefined
		);
		expect(result['lens-item-1']).toHaveLength(1);
	});

	it('ignores items without a cached lens or ranges', () => {
		expect(
			collectLensRangeWarnings([item({ id: 'lens-item-1', odSphere: 4 })], () => undefined)
		).toEqual({});

		const noRanges = { id: 'lens-1', ranges: [] } as unknown as LensCatalogItemWithRelations;
		expect(
			collectLensRangeWarnings([item({ id: 'lens-item-1', odSphere: 4 })], (id) =>
				id === 'lens-1' ? noRanges : undefined
			)
		).toEqual({});
	});
});
