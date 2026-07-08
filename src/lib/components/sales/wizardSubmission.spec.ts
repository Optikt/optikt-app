import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';
import { LensPriceType, LensType, SaleItemType } from '$lib/shared/enums/lensTypes';

import type { SaleItemRow } from './newSaleTypes';
import {
	buildPrescriptionPayload,
	buildQuoteItemsFromWizard,
	buildSaleItemsFromWizard
} from './wizardSubmission';

const lensItems = [
	{
		id: 'lens-1',
		name: 'Novak CR39 Monofocal',
		pairPurchasePrice: 4.6,
		mountingPrice: 3,
		shippingPrice: 25,
		salePrice: 25,
		priceType: LensPriceType.PAIR,
		isTaxable: false,
		supplier: { name: 'Novak' }
	}
] as const;

const lensRow: import("./newSaleTypes").SaleItemRow = {
	id: 'row-1',
	kind: 'lens' as const,
	productId: '',
	quantity: 1,
	lensPair: {
		catalogItemId: 'lens-1',
		od: {
			enabled: true,
			prescription: { sphere: 2, cylinder: -0.5, axis: 180, addition: 1.5 },
			dp: null,
			np: null
		},
		oi: {
			enabled: true,
			prescription: { sphere: 1.75, cylinder: -0.25, axis: 170, addition: 1.5 },
			dp: null,
			np: null
		},
		lensType: LensType.MONOFOCAL,
		doctorName: ''
	},
	treatments: [
		{
			supplierTreatmentId: 'treatment-1',
			name: 'Antirreflejo',
			category: 'AR',
			price: 5,
			isTaxable: true
		}
	],
	unitPrice: 25,
	discount: 0,
	discountType: DiscountType.FIXED,
	notes: '',
	costOverrides: { baseCost: 4.6, mountingPrice: 3, shippingPrice: 10 },
	shippingCostPending: true,
	isIncludedAccessory: false,
	includedAccessoryParentItemId: null
} as const;

describe('buildSaleItemsFromWizard', () => {
	it('serializes one lens pair row plus treatment children', () => {
		const result = buildSaleItemsFromWizard([lensRow], [], [...lensItems] as never);

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			itemType: SaleItemType.LENS_PAIR,
			quantity: 1,
			unitPrice: 25,
			odSphere: 2,
			osSphere: 1.75,
			snapshotBaseCost: 4.6,
			snapshotMountingPrice: 3,
			snapshotShippingPrice: undefined,
			shippingCostPending: true
		});
		expect(result[1]).toMatchObject({
			itemType: SaleItemType.TREATMENT,
			parentSaleItemId: result[0].id,
			quantity: 2,
			unitPrice: 5
		});
	});
});

describe('buildQuoteItemsFromWizard', () => {
	it('serializes one quote lens row with both eyes on the same item', () => {
		const result = buildQuoteItemsFromWizard([lensRow], [], [...lensItems] as never);

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			itemType: SaleItemType.LENS_PAIR,
			odSphere: 2,
			osSphere: 1.75,
			quantity: 1,
			unitPrice: 25
		});
		expect(result[1]).toMatchObject({
			itemType: SaleItemType.TREATMENT,
			parentQuoteItemId: result[0].id,
			quantity: 2
		});
	});
});

describe('buildPrescriptionPayload', () => {
	it('builds a current prescription payload from the first lens item', () => {
		const item: any = {
			id: 'row-1',
			kind: 'lens',
			productId: '',
			quantity: 1,
			lensPair: {
				catalogItemId: 'lens-1',
				od: {
					enabled: true,
					prescription: { sphere: 2, cylinder: -0.5, axis: 180, addition: 1.5 },
					dp: null,
					np: null
				},
				oi: {
					enabled: true,
					prescription: { sphere: 1.75, cylinder: -0.25, axis: 170, addition: 1.5 },
					dp: null,
					np: null
				},
				lensType: LensType.PROGRESSIVE,
				doctorName: 'Dr. Martinez'
			},
			unitPrice: 25,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: '',
			costOverrides: { baseCost: 0, mountingPrice: 0, shippingPrice: 0 },
	treatments: [
		{
			supplierTreatmentId: 'treatment-1',
			name: 'Antirreflejo',
			category: 'AR',
			price: 5,
			isTaxable: true
		}
	],
			shippingCostPending: false,
			isIncludedAccessory: false,
			includedAccessoryParentItemId: null
		};
		const result = buildPrescriptionPayload([item], '2026-04-14');

		expect(result).toMatchObject({
			prescriptionDate: '2026-04-14',
			odSphere: 2,
			osSphere: 1.75,
			recommendedLensType: LensType.PROGRESSIVE,
			doctorName: 'Dr. Martinez',
			isCurrent: true
		});
	});

	it('returns undefined when no lens items have prescription values', () => {
		const item: any = {
			id: 'row-1',
			kind: 'product',
			productId: 'prod-1',
			quantity: 1,
			unitPrice: 10,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: '',
			costOverrides: { baseCost: 0, mountingPrice: 0, shippingPrice: 0 },
	treatments: [
		{
			supplierTreatmentId: 'treatment-1',
			name: 'Antirreflejo',
			category: 'AR',
			price: 5,
			isTaxable: true
		}
	],
			shippingCostPending: false,
			isIncludedAccessory: false,
			includedAccessoryParentItemId: null
		};
		expect(buildPrescriptionPayload([item], '2026-04-14')).toBeUndefined();
	});
});
