import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';
import { LensType } from '$lib/shared/enums/lensTypes';

import type { SaleItemRow } from '../newSaleTypes';
import {
	buildStep2PrescriptionConfirmation,
	getLensRangeWarningsForItem,
	getLensTypeSuggestionState
} from './lensConfirmation';
import { makeConfirmation, makeConfirmationLensRow, makeLensItem } from './testFixtures';

describe('buildStep2PrescriptionConfirmation', () => {
	it('marks matching lens type when prescription matches catalog', () => {
		const confirmation = makeConfirmation();

		expect(confirmation.hasLensItems).toBe(true);
		expect(confirmation.items[0]?.typeMatches).toBe(true);
	});

	it('marks lens type mismatch when prescription and catalog differ', () => {
		const confirmation = makeConfirmation({ lensType: LensType.PROGRESSIVE });

		expect(confirmation.items[0]?.typeMatches).toBe(false);
		expect(confirmation.items[0]?.catalogLensType).toBe(LensType.MONOFOCAL);
		expect(confirmation.items[0]?.prescriptionLensType).toBe(LensType.PROGRESSIVE);
	});

	it('marks enabled eyes as in range when prescription fits the catalog', () => {
		const lens = makeLensItem({
			ranges: [
				{
					id: 'range-1',
					lensCatalogItemId: 'lens-1',
					sphereMin: -2,
					sphereMax: 2,
					cylinderMin: -2,
					cylinderMax: 0,
					additionMin: null,
					additionMax: null,
					createdAt: '2026-04-20T00:00:00.000Z',
					updatedAt: '2026-04-20T00:00:00.000Z'
				}
			]
		});

		const confirmation = makeConfirmation({}, [makeConfirmationLensRow()], [lens]);

		expect(confirmation.items[0]?.eyes.map((eye) => eye.status)).toEqual(['in-range', 'in-range']);
		expect(getLensRangeWarningsForItem('row-1', confirmation)).toHaveLength(0);
	});

	it('marks eyes outside of range when no optical range matches', () => {
		const lens = makeLensItem({
			ranges: [
				{
					id: 'range-1',
					lensCatalogItemId: 'lens-1',
					sphereMin: -1,
					sphereMax: 1,
					cylinderMin: -1,
					cylinderMax: 0,
					additionMin: null,
					additionMax: null,
					createdAt: '2026-04-20T00:00:00.000Z',
					updatedAt: '2026-04-20T00:00:00.000Z'
				}
			]
		});

		const confirmation = makeConfirmation(
			{ odSphere: 3.5, oiSphere: 0.75 },
			[makeConfirmationLensRow()],
			[lens]
		);

		expect(confirmation.items[0]?.eyes[0]?.status).toBe('out-of-range');
		expect(getLensRangeWarningsForItem('row-1', confirmation)).toHaveLength(1);
	});

	it('marks eyes for lab review when the lens has no defined ranges', () => {
		const confirmation = makeConfirmation();

		expect(confirmation.items[0]?.hasRanges).toBe(false);
		expect(confirmation.items[0]?.eyes.map((eye) => eye.status)).toEqual([
			'lab-review',
			'lab-review'
		]);
	});

	it('flags multiple lenses in the same operation', () => {
		const secondLens = makeLensItem({ id: 'lens-2', name: 'Beta Lens' });
		const firstRow = makeConfirmationLensRow('row-1');
		const secondRow = makeConfirmationLensRow('row-2');
		secondRow.lensPair!.catalogItemId = 'lens-2';

		const confirmation = makeConfirmation({}, [firstRow, secondRow], [makeLensItem(), secondLens]);

		expect(confirmation.lensCount).toBe(2);
		expect(confirmation.hasMultipleLenses).toBe(true);
	});

	it('returns a neutral state when there are no lens items', () => {
		const confirmation = buildStep2PrescriptionConfirmation(
			[
				{
					id: 'product-1',
					kind: 'product',
					productId: 'product-1',
					quantity: 1,
					unitPrice: 10,
					discount: 0,
					discountType: DiscountType.FIXED,
					notes: '',
					isIncludedAccessory: false,
					includedAccessoryParentItemId: null
				} satisfies SaleItemRow
			],
			[makeLensItem()]
		);

		expect(confirmation.hasLensItems).toBe(false);
		expect(confirmation.items).toEqual([]);
	});

	it('accepts numeric prescription values without crashing while editing', () => {
		const lensRow = makeConfirmationLensRow();
		if (lensRow.lensPair) {
			lensRow.lensPair.od.prescription = { sphere: 1, cylinder: -0.5, axis: 90, addition: null };
			lensRow.lensPair.oi.prescription = {
				sphere: null,
				cylinder: null,
				axis: null,
				addition: null
			};
		}
		const confirmation = buildStep2PrescriptionConfirmation([lensRow], [makeLensItem()]);

		expect(confirmation.items[0]?.eyes[0]?.prescriptionSummary).toContain('Esf +1.00');
	});
});

describe('getLensTypeSuggestionState', () => {
	it('returns the single catalog lens type when all selected lenses match', () => {
		const firstRow = makeConfirmationLensRow('row-1');
		const secondRow = makeConfirmationLensRow('row-2');

		const state = getLensTypeSuggestionState(
			[firstRow, secondRow],
			[makeLensItem(), makeLensItem({ id: 'lens-2' })],
			null
		);

		expect(state.catalogLensType).toBe(LensType.MONOFOCAL);
		expect(state.hasMixedCatalogLensTypes).toBe(false);
	});

	it('flags a conflict when the existing prescription type differs from the selected catalog lens', () => {
		const state = getLensTypeSuggestionState(
			[makeConfirmationLensRow()],
			[makeLensItem({ type: LensType.PROGRESSIVE })],
			LensType.MONOFOCAL
		);

		expect(state.catalogLensType).toBe(LensType.PROGRESSIVE);
		expect(state.conflictingPrescriptionLensType).toBe(LensType.MONOFOCAL);
	});

	it('detects mixed lens types and disables automatic single-type suggestion', () => {
		const firstRow = makeConfirmationLensRow('row-1');
		const secondRow = makeConfirmationLensRow('row-2');
		secondRow.lensPair!.catalogItemId = 'lens-2';

		const state = getLensTypeSuggestionState(
			[firstRow, secondRow],
			[
				makeLensItem({ id: 'lens-1', type: LensType.MONOFOCAL }),
				makeLensItem({ id: 'lens-2', type: LensType.PROGRESSIVE })
			],
			LensType.MONOFOCAL
		);

		expect(state.catalogLensType).toBeNull();
		expect(state.hasMixedCatalogLensTypes).toBe(true);
		expect(state.catalogLensTypes).toEqual([LensType.MONOFOCAL, LensType.PROGRESSIVE]);
	});
});
