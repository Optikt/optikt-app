import { describe, it, expect } from 'vitest';
import { buildFulfillmentPlan } from './fulfillmentPlanner';
import {
	LensTreatmentAvailability,
	type LensPurchasePolicy,
	type LensTreatmentPolicy
} from '$lib/shared/contracts/lenses';
import { LensPricingUnit } from '$lib/shared/enums/lensTypes';
import { PatientEye } from '$lib/shared/contracts/common';
import { FulfillmentSource, FulfillmentWarningCode } from '$lib/shared/contracts/fulfillment';
import type { LensRequirement, CatalogItemForPlanning } from './types';
import type { CompatibilityVerdict } from '$lib/shared/matching/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePolicy(overrides: Partial<LensPurchasePolicy> = {}): LensPurchasePolicy {
	return {
		listOrderUnit: LensPricingUnit.UNIT,
		allowsSingleUnitOrder: false,
		singleUnitRequiresConfirmation: false,
		singleUnitSurcharge: 0,
		minimumOrderUnits: 1,
		mountingPrice: 0,
		shippingPrice: 0,
		...overrides
	};
}

function makeTreatmentPolicies(
	overrides: Partial<Record<string, Partial<LensTreatmentPolicy>>> = {}
): LensTreatmentPolicy[] {
	const policies: LensTreatmentPolicy[] = [];
	if (overrides.AR) {
		policies.push({
			code: 'AR',
			availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
			additionalPrice: 100,
			requiresConfirmation: false,
			...overrides.AR
		});
	}
	if (overrides.BLUECUT) {
		policies.push({
			code: 'BLUECUT',
			availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
			additionalPrice: 150,
			requiresConfirmation: false,
			...overrides.BLUECUT
		});
	}
	return policies;
}

function makeCatalogItem(
	id: string,
	overrides: Partial<CatalogItemForPlanning> = {}
): CatalogItemForPlanning {
	return {
		id,
		name: `Lens ${id}`,
		basePrice: 500,
		purchasePolicy: makePolicy(),
		treatmentPolicies: [],
		...overrides
	};
}

function makeRequirement(
	eye: PatientEye,
	catalogItemId: string,
	overrides: Partial<LensRequirement> = {}
): LensRequirement {
	return {
		requirementId: `req-${eye}-${catalogItemId}`,
		eye,
		catalogItemId,
		compatibilityVerdict: 'EXACT_MATCH' as CompatibilityVerdict,
		selectedOptionalTreatments: [],
		...overrides
	};
}

function catalogMap(...items: CatalogItemForPlanning[]): Map<string, CatalogItemForPlanning> {
	return new Map(items.map((i) => [i.id, i]));
}

// ===========================================================================
// UNIT PRICING — each lens independently priced
// ===========================================================================

describe('buildFulfillmentPlan — UNIT pricing', () => {
	const unitItem = makeCatalogItem('lens-1', {
		basePrice: 500,
		purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT })
	});

	it('plans two independent lines for a pair (OD + OS)', () => {
		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-1'), makeRequirement(PatientEye.OI, 'lens-1')],
			catalogMap(unitItem)
		);

		expect(plan.lines).toHaveLength(2);
		expect(plan.lines[0]?.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(plan.lines[1]?.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(plan.totalCost).toBe(1000); // 500 + 500
		expect(plan.surplus).toHaveLength(0);
	});

	it('plans a single line for one eye', () => {
		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-1')],
			catalogMap(unitItem)
		);

		expect(plan.lines).toHaveLength(1);
		expect(plan.lines[0].cost?.basePrice).toBe(500);
		expect(plan.totalCost).toBe(500);
		expect(plan.surplus).toHaveLength(0);
	});

	it('adds treatment cost to each line', () => {
		const itemWithTreatments = makeCatalogItem('lens-ar', {
			basePrice: 500,
			purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT }),
			treatmentPolicies: makeTreatmentPolicies({ AR: { additionalPrice: 100 } })
		});

		const plan = buildFulfillmentPlan(
			[
				makeRequirement(PatientEye.OD, 'lens-ar', { selectedOptionalTreatments: ['AR'] }),
				makeRequirement(PatientEye.OI, 'lens-ar', { selectedOptionalTreatments: ['AR'] })
			],
			catalogMap(itemWithTreatments)
		);

        console.log("plan: ", JSON.stringify(plan, null, 2))
		expect(plan.lines).toHaveLength(1);
		expect(plan.lines[0].cost?.treatmentPrice).toBe(100);
		expect(plan.lines[0].cost?.totalCost).toBe(600);
		expect(plan.totalCost).toBe(1200);
	});

	it('includes mounting and shipping costs', () => {
		const itemWithOps = makeCatalogItem('lens-ops', {
			basePrice: 500,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.UNIT,
				mountingPrice: 50,
				shippingPrice: 30
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-ops')],
			catalogMap(itemWithOps)
		);

		expect(plan.lines[0]!.cost!.mountingPrice).toBe(50);
		expect(plan.lines[0]!.cost!.shippingPrice).toBe(30);
		expect(plan.lines[0]!.cost!.totalCost).toBe(580);
	});
});

// ===========================================================================
// PAIR PRICING — natural pair
// ===========================================================================

describe('buildFulfillmentPlan — PAIR pricing, natural pair', () => {
	const pairItem = makeCatalogItem('lens-pair', {
		basePrice: 400,
		purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.PAIR })
	});

	it('handles a natural pair (OD + OS same item)', () => {
		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-pair'), makeRequirement(PatientEye.OI, 'lens-pair')],
			catalogMap(pairItem)
		);

		expect(plan.lines).toHaveLength(2);
		expect(plan.lines[0]!.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(plan.lines[1]!.source).toBe(FulfillmentSource.PAIR_BUNDLED);
		expect(plan.surplus).toHaveLength(0);
		// Both lines carry cost — total = 2 × 400
		expect(plan.totalCost).toBe(800);
	});

	it('no surplus and no single-unit warnings for a natural pair', () => {
		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-pair'), makeRequirement(PatientEye.OI, 'lens-pair')],
			catalogMap(pairItem)
		);

		expect(plan.surplus).toHaveLength(0);
		expect(plan.allWarnings).not.toContain(FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS);
		expect(plan.allWarnings).not.toContain(FulfillmentWarningCode.SINGLE_UNIT_SURCHARGE);
	});
});

// ===========================================================================
// PAIR PRICING — single eye need, single unit allowed
// ===========================================================================

describe('buildFulfillmentPlan — PAIR pricing, single unit allowed', () => {
	it('orders single unit with surcharge when allowed', () => {
		const item = makeCatalogItem('lens-flex', {
			basePrice: 400,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.PAIR,
				allowsSingleUnitOrder: true,
				singleUnitSurcharge: 50,
				singleUnitRequiresConfirmation: false
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-flex')],
			catalogMap(item)
		);

		expect(plan.lines).toHaveLength(1);
		expect(plan.lines[0]!.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(plan.lines[0]!.cost!.surchargePrice).toBe(50);
		expect(plan.lines[0]!.cost!.totalCost).toBe(450);
		expect(plan.allWarnings).toContain(FulfillmentWarningCode.SINGLE_UNIT_SURCHARGE);
		expect(plan.surplus).toHaveLength(0);
	});

	it('requires confirmation when policy says so', () => {
		const item = makeCatalogItem('lens-confirm', {
			basePrice: 400,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.PAIR,
				allowsSingleUnitOrder: true,
				singleUnitSurcharge: 0,
				singleUnitRequiresConfirmation: true
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-confirm')],
			catalogMap(item)
		);

		expect(plan.requiresAnyConfirmation).toBe(true);
		expect(plan.allWarnings).toContain(FulfillmentWarningCode.SINGLE_UNIT_REQUIRES_CONFIRMATION);
	});

	it('no surcharge warning when surcharge is 0', () => {
		const item = makeCatalogItem('lens-no-surcharge', {
			basePrice: 400,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.PAIR,
				allowsSingleUnitOrder: true,
				singleUnitSurcharge: 0
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-no-surcharge')],
			catalogMap(item)
		);

		expect(plan.allWarnings).not.toContain(FulfillmentWarningCode.SINGLE_UNIT_SURCHARGE);
		expect(plan.lines[0]!.cost!.surchargePrice).toBe(0);
	});
});

// ===========================================================================
// PAIR PRICING — single eye need, single unit NOT allowed → surplus
// ===========================================================================

describe('buildFulfillmentPlan — PAIR pricing, forced pair → surplus', () => {
	const strictPairItem = makeCatalogItem('lens-strict', {
		basePrice: 400,
		purchasePolicy: makePolicy({
			listOrderUnit: LensPricingUnit.PAIR,
			allowsSingleUnitOrder: false
		})
	});

	it('creates surplus when buying pair for single eye', () => {
		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-strict')],
			catalogMap(strictPairItem)
		);

		expect(plan.lines).toHaveLength(1);
		expect(plan.lines[0]!.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(plan.allWarnings).toContain(FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS);
		expect(plan.surplus).toHaveLength(1);
		expect(plan.surplus[0]!.catalogItemId).toBe('lens-strict');
		expect(plan.surplus[0]!.surplusUnits).toBe(1);
	});

	it('surplus cost is included in the plan cost', () => {
		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-strict')],
			catalogMap(strictPairItem)
		);

		// Line cost = 400 (base). Surplus cost also 400 (included in pair purchase).
		expect(plan.surplus[0]!.surplusCostIncluded).toBe(400);
	});
});

// ===========================================================================
// CONSULT_REQUIRED verdicts
// ===========================================================================

describe('buildFulfillmentPlan — CONSULT_REQUIRED', () => {
	const item = makeCatalogItem('lens-consult', {
		basePrice: 600,
		purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT })
	});

	it('adds CONSULT_REQUIRED warning and requires confirmation', () => {
		const plan = buildFulfillmentPlan(
			[
				makeRequirement(PatientEye.OD, 'lens-consult', {
					compatibilityVerdict: 'CONSULT_REQUIRED'
				})
			],
			catalogMap(item)
		);

		expect(plan.allWarnings).toContain(FulfillmentWarningCode.CONSULT_REQUIRED);
		expect(plan.requiresAnyConfirmation).toBe(true);
		expect(plan.lines[0]!.requiresConfirmation).toBe(true);
	});

	it('only marks CONSULT_REQUIRED lines, not EXACT_MATCH lines', () => {
		const plan = buildFulfillmentPlan(
			[
				makeRequirement(PatientEye.OD, 'lens-consult', {
					compatibilityVerdict: 'CONSULT_REQUIRED'
				}),
				makeRequirement(PatientEye.OI, 'lens-consult', {
					compatibilityVerdict: 'EXACT_MATCH'
				})
			],
			catalogMap(item)
		);

		expect(plan.lines[0]!.requiresConfirmation).toBe(true);
		expect(plan.lines[1]!.requiresConfirmation).toBe(false);
	});
});

// ===========================================================================
// MINIMUM ORDER UNITS
// ===========================================================================

describe('buildFulfillmentPlan — minimum order units', () => {
	it('warns when units are below minimum', () => {
		const item = makeCatalogItem('lens-min', {
			basePrice: 500,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.UNIT,
				minimumOrderUnits: 2
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-min')],
			catalogMap(item)
		);

		expect(plan.allWarnings).toContain(FulfillmentWarningCode.BELOW_MINIMUM_ORDER);
	});

	it('no warning when units meet minimum', () => {
		const item = makeCatalogItem('lens-min2', {
			basePrice: 500,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.UNIT,
				minimumOrderUnits: 2
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-min2'), makeRequirement(PatientEye.OI, 'lens-min2')],
			catalogMap(item)
		);

		expect(plan.allWarnings).not.toContain(FulfillmentWarningCode.BELOW_MINIMUM_ORDER);
	});
});

// ===========================================================================
// MIXED ITEMS — different catalog items in same plan
// ===========================================================================

describe('buildFulfillmentPlan — mixed catalog items', () => {
	it('handles different catalog items for OD and OS', () => {
		const itemA = makeCatalogItem('lens-A', {
			basePrice: 500,
			purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT })
		});
		const itemB = makeCatalogItem('lens-B', {
			basePrice: 700,
			purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT })
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-A'), makeRequirement(PatientEye.OI, 'lens-B')],
			catalogMap(itemA, itemB)
		);

		expect(plan.lines).toHaveLength(2);
		expect(plan.lines[0]!.cost!.basePrice).toBe(500);
		expect(plan.lines[1]!.cost!.basePrice).toBe(700);
		expect(plan.totalCost).toBe(1200);
	});

	it('handles mix of UNIT and PAIR items', () => {
		const unitItem = makeCatalogItem('lens-unit', {
			basePrice: 500,
			purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT })
		});
		const pairItem = makeCatalogItem('lens-pair', {
			basePrice: 400,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.PAIR,
				allowsSingleUnitOrder: false
			})
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-unit'), makeRequirement(PatientEye.OI, 'lens-pair')],
			catalogMap(unitItem, pairItem)
		);

		expect(plan.lines).toHaveLength(2);
		// Unit item: normal order
		expect(plan.lines.find((l) => l.catalogItemId === 'lens-unit')!.source).toBe(
			FulfillmentSource.SUPPLIER_ORDER
		);
		// Pair item with single need: forced pair → surplus
		const pairLine = plan.lines.find((l) => l.catalogItemId === 'lens-pair')!;
		expect(pairLine.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(plan.surplus).toHaveLength(1);
		expect(plan.allWarnings).toContain(FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS);
	});
});

// ===========================================================================
// TREATMENT COST CALCULATION
// ===========================================================================

describe('buildFulfillmentPlan — treatment costs', () => {
	it('adds only OPTIONAL_EXTRA treatment costs, ignores INHERENT', () => {
		const item = makeCatalogItem('lens-t', {
			basePrice: 500,
			purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT }),
			treatmentPolicies: [
				{
					code: 'AR',
					availability: LensTreatmentAvailability.INHERENT,
					additionalPrice: 999, // should be ignored — inherent
					requiresConfirmation: false
				},
				{
					code: 'BLUECUT',
					availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
					additionalPrice: 150,
					requiresConfirmation: false
				}
			]
		});

		const plan = buildFulfillmentPlan(
			[
				makeRequirement(PatientEye.OD, 'lens-t', {
					selectedOptionalTreatments: ['AR', 'BLUECUT']
				})
			],
			catalogMap(item)
		);

		// Only BLUECUT adds cost (150), AR is INHERENT so additionalPrice ignored
		expect(plan.lines[0]!.cost!.treatmentPrice).toBe(150);
		expect(plan.lines[0]!.cost!.totalCost).toBe(650);
	});

	it('zero treatment cost when no treatments selected', () => {
		const item = makeCatalogItem('lens-no-t', {
			basePrice: 500,
			purchasePolicy: makePolicy({ listOrderUnit: LensPricingUnit.UNIT }),
			treatmentPolicies: makeTreatmentPolicies({ AR: { additionalPrice: 100 } })
		});

		const plan = buildFulfillmentPlan(
			[makeRequirement(PatientEye.OD, 'lens-no-t', { selectedOptionalTreatments: [] })],
			catalogMap(item)
		);

		expect(plan.lines[0]!.cost!.treatmentPrice).toBe(0);
	});
});

// ===========================================================================
// ERROR HANDLING
// ===========================================================================

describe('buildFulfillmentPlan — errors', () => {
	it('throws if catalog item not found', () => {
		expect(() =>
			buildFulfillmentPlan([makeRequirement(PatientEye.OD, 'missing-item')], new Map())
		).toThrow('Catalog item not found: missing-item');
	});
});

// ===========================================================================
// COMPLEX REAL-WORLD SCENARIO
// ===========================================================================

describe('buildFulfillmentPlan — real-world scenario', () => {
	it('progressive pair: AR on both eyes, pair pricing, mounting + shipping', () => {
		const progressive = makeCatalogItem('progressive-1', {
			basePrice: 800,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.PAIR,
				mountingPrice: 75,
				shippingPrice: 40
			}),
			treatmentPolicies: makeTreatmentPolicies({
				AR: { additionalPrice: 120 },
				BLUECUT: { additionalPrice: 180 }
			})
		});

		const plan = buildFulfillmentPlan(
			[
				makeRequirement(PatientEye.OD, 'progressive-1', {
					compatibilityVerdict: 'EXACT_MATCH',
					selectedOptionalTreatments: ['AR']
				}),
				makeRequirement(PatientEye.OI, 'progressive-1', {
					compatibilityVerdict: 'EXACT_MATCH',
					selectedOptionalTreatments: ['AR']
				})
			],
			catalogMap(progressive)
		);

		// Natural pair — no surplus
		expect(plan.surplus).toHaveLength(0);
		expect(plan.lines).toHaveLength(2);

		// First line: SUPPLIER_ORDER with full cost
		const line1 = plan.lines[0]!;
		expect(line1.source).toBe(FulfillmentSource.SUPPLIER_ORDER);
		expect(line1.cost!.basePrice).toBe(800);
		expect(line1.cost!.treatmentPrice).toBe(120);
		expect(line1.cost!.mountingPrice).toBe(75);
		expect(line1.cost!.shippingPrice).toBe(40);
		expect(line1.cost!.totalCost).toBe(1035);

		// Second line: PAIR_BUNDLED with cost
		const line2 = plan.lines[1]!;
		expect(line2.source).toBe(FulfillmentSource.PAIR_BUNDLED);
		expect(line2.cost!.totalCost).toBe(1035);

		// Total = 1035 + 1035 = 2070
		expect(plan.totalCost).toBe(2070);
		expect(plan.requiresAnyConfirmation).toBe(false);
	});

	it('consult-required pair with forced single unit → surplus + confirmation', () => {
		const consultItem = makeCatalogItem('consult-pair', {
			basePrice: 600,
			purchasePolicy: makePolicy({
				listOrderUnit: LensPricingUnit.PAIR,
				allowsSingleUnitOrder: false
			})
		});

		const plan = buildFulfillmentPlan(
			[
				makeRequirement(PatientEye.OI, 'consult-pair', {
					compatibilityVerdict: 'CONSULT_REQUIRED'
				})
			],
			catalogMap(consultItem)
		);

		expect(plan.lines).toHaveLength(1);
		expect(plan.allWarnings).toContain(FulfillmentWarningCode.CONSULT_REQUIRED);
		expect(plan.allWarnings).toContain(FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS);
		expect(plan.requiresAnyConfirmation).toBe(true);
		expect(plan.surplus).toHaveLength(1);
	});
});
