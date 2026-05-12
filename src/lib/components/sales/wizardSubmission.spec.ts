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

const lensRow: SaleItemRow = {
	id: 'row-1',
	kind: 'lens',
	productId: '',
	quantity: 1,
	lensPair: {
		catalogItemId: 'lens-1',
		od: {
			enabled: true,
			prescription: { sphere: 2, cylinder: -0.5, axis: 180, addition: 1.5 }
		},
		oi: {
			enabled: true,
			prescription: { sphere: 1.75, cylinder: -0.25, axis: 170, addition: 1.5 }
		}
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
	freeItem: null,
	unitPrice: 25,
	discount: 0,
	discountType: DiscountType.FIXED,
	notes: '',
	costOverrides: null,
	shippingCostPending: true,
	isIncludedAccessory: false,
	includedAccessoryParentItemId: null
};

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
	it('builds a current prescription payload from wizard values', () => {
		const result = buildPrescriptionPayload(
			{
				odSphere: '2.00',
				odCylinder: '-0.50',
				odAxis: '180',
				odAddition: '1.50',
				oiSphere: '1.75',
				oiCylinder: '-0.25',
				oiAxis: '170',
				oiAddition: '1.50',
				lensType: LensType.PROGRESSIVE,
				doctorName: 'Dr. Martinez'
			},
			'2026-04-14'
		);

		expect(result).toMatchObject({
			prescriptionDate: '2026-04-14',
			odSphere: '2.00',
			osSphere: '1.75',
			recommendedLensType: LensType.PROGRESSIVE,
			doctorName: 'Dr. Martinez',
			isCurrent: true
		});
	});

	it('returns undefined when no prescription values are present', () => {
		expect(
			buildPrescriptionPayload(
				{
					odSphere: '',
					odCylinder: '',
					odAxis: '',
					odAddition: '',
					oiSphere: '',
					oiCylinder: '',
					oiAxis: '',
					oiAddition: '',
					lensType: LensType.MONOFOCAL,
					doctorName: ''
				},
				'2026-04-14'
			)
		).toBeUndefined();
	});
});
