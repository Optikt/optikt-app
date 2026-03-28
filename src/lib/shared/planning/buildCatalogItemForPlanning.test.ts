import { describe, it, expect } from 'vitest';
import { buildCatalogItemForPlanning, type RawCatalogItem } from './buildCatalogItemForPlanning';
import {
	LensTreatmentAvailability,
	findTreatmentPolicy,
	toTreatmentPolicy
} from '$lib/shared/contracts/lenses';
import { LensPricingUnit } from '$lib/shared/enums/lensTypes';

function makeRaw(overrides: Partial<RawCatalogItem> = {}): RawCatalogItem {
	return {
		id: 'item-1',
		name: 'Test Lens',
		basePrice: 100,
		pricingUnit: LensPricingUnit.PAIR,
		allowsSingleUnitOrder: false,
		singleUnitRequiresConfirmation: false,
		singleUnitSurcharge: 0,
		minimumOrderUnits: 1,
		mountingPrice: 10,
		shippingPrice: 5,
		treatmentPolicies: [],
		...overrides
	};
}

describe('buildCatalogItemForPlanning', () => {
	it('assembles purchasePolicy from flat DB columns', () => {
		const result = buildCatalogItemForPlanning(makeRaw(), []);
		expect(result.id).toBe('item-1');
		expect(result.name).toBe('Test Lens');
		expect(result.basePrice).toBe(100);
		expect(result.purchasePolicy.listOrderUnit).toBe(LensPricingUnit.PAIR);
		expect(result.purchasePolicy.mountingPrice).toBe(10);
		expect(result.purchasePolicy.shippingPrice).toBe(5);
		expect(result.purchasePolicy.requiresSamePrescriptionForPair).toBe(false);
	});

	it('resolves treatment policies with supplier defaults and item overrides', () => {
		const supplierDefaults = [
			toTreatmentPolicy('AR', {
				availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
				additionalPrice: 50
			})
		];
		const raw = makeRaw({
			treatmentPolicies: [
				toTreatmentPolicy('AR', { availability: LensTreatmentAvailability.INHERENT })
			]
		});
		const result = buildCatalogItemForPlanning(raw, supplierDefaults);
		const ar = findTreatmentPolicy(result.treatmentPolicies, 'AR')!;
		expect(ar.availability).toBe(LensTreatmentAvailability.INHERENT);
		expect(ar.additionalPrice).toBe(0);
	});

	it('uses supplier defaults when item has no overrides', () => {
		const supplierDefaults = [
			toTreatmentPolicy('BLUECUT', {
				availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
				additionalPrice: 30,
				requiresConfirmation: true
			})
		];
		const result = buildCatalogItemForPlanning(makeRaw(), supplierDefaults);
		const bc = findTreatmentPolicy(result.treatmentPolicies, 'BLUECUT')!;
		expect(bc.availability).toBe(LensTreatmentAvailability.OPTIONAL_EXTRA);
		expect(bc.additionalPrice).toBe(30);
		expect(bc.requiresConfirmation).toBe(true);
	});

	it('always produces one policy per core treatment code', () => {
		const result = buildCatalogItemForPlanning(makeRaw(), []);
		expect(result.treatmentPolicies).toHaveLength(2);
		const codes = result.treatmentPolicies.map((p) => p.code).sort();
		expect(codes).toEqual(['AR', 'BLUECUT']);
	});

	it('does not duplicate policies when supplier and item both define the same code', () => {
		const supplierDefaults = [
			toTreatmentPolicy('AR', {
				availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
				additionalPrice: 50
			}),
			toTreatmentPolicy('BLUECUT', {
				availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
				additionalPrice: 20
			})
		];
		const raw = makeRaw({
			treatmentPolicies: [
				toTreatmentPolicy('AR', { availability: LensTreatmentAvailability.INHERENT }),
				toTreatmentPolicy('BLUECUT')
			]
		});
		const result = buildCatalogItemForPlanning(raw, supplierDefaults);
		expect(result.treatmentPolicies).toHaveLength(2);
		const codes = result.treatmentPolicies.map((p) => p.code).sort();
		expect(codes).toEqual(['AR', 'BLUECUT']);
		// Item overrides win
		expect(findTreatmentPolicy(result.treatmentPolicies, 'AR')!.availability).toBe(
			LensTreatmentAvailability.INHERENT
		);
		expect(findTreatmentPolicy(result.treatmentPolicies, 'BLUECUT')!.availability).toBe(
			LensTreatmentAvailability.NOT_AVAILABLE
		);
	});
});
