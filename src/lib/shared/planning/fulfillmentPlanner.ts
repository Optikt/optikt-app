import { LensPricingUnit } from '$lib/shared/enums/lensTypes';
import { LensTreatmentAvailability, findTreatmentPolicy } from '$lib/shared/contracts/lenses';
import { FulfillmentSource, FulfillmentWarningCode } from '$lib/shared/contracts/fulfillment';
import type { FulfillmentCostBreakdown } from '$lib/shared/contracts/fulfillment';
import type {
	LensRequirement,
	CatalogItemForPlanning,
	SurplusUnitForPlanning,
	FulfillmentPlanResult,
	FulfillmentPlanResultLine,
	SurplusInfo
} from './types';

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Calculate cost breakdown for a single lens unit.
 */
function calculateLineCost(
	requirement: LensRequirement,
	item: CatalogItemForPlanning,
	applySingleUnitSurcharge: boolean
): FulfillmentCostBreakdown {
	const basePrice = item.basePrice;

	let treatmentPrice = 0;
	for (const code of requirement.selectedOptionalTreatments) {
		const policy = findTreatmentPolicy(item.treatmentPolicies, code);
		if (policy && policy.availability === LensTreatmentAvailability.OPTIONAL_EXTRA) {
			treatmentPrice += policy.additionalPrice;
		}
	}

	const surchargePrice = applySingleUnitSurcharge ? item.purchasePolicy.singleUnitSurcharge : 0;

	const mountingPrice = item.purchasePolicy.mountingPrice;
	const shippingPrice = item.purchasePolicy.shippingPrice;

	return {
		basePrice,
		treatmentPrice,
		surchargePrice,
		mountingPrice,
		shippingPrice,
		totalCost: basePrice + treatmentPrice + surchargePrice + mountingPrice + shippingPrice
	};
}

// ============================================================================
// GROUPING LOGIC
// ============================================================================

interface RequirementGroup {
	catalogItemId: string;
	requirements: LensRequirement[];
}

/** Group requirements by catalog item — pair logic applies per-item */
function groupByCatalogItem(requirements: LensRequirement[]): RequirementGroup[] {
	const map = new Map<string, LensRequirement[]>();
	for (const req of requirements) {
		const existing = map.get(req.catalogItemId);
		if (existing) {
			existing.push(req);
		} else {
			map.set(req.catalogItemId, [req]);
		}
	}
	return Array.from(map.entries()).map(([catalogItemId, reqs]) => ({
		catalogItemId,
		requirements: reqs
	}));
}

// ============================================================================
// PLAN GENERATION
// ============================================================================

/**
 * Build a fulfillment plan for a set of lens requirements.
 *
 * Rules:
 * 1. Group requirements by catalog item.
 * 2. For each group, first try to fulfill from available surplus units.
 * 3. For remaining (unfulfilled) requirements, check the item's purchase policy:
 *    a. UNIT pricing → each requirement is an independent order line.
 *    b. PAIR pricing with 2 requirements → natural pair, one cost covers both.
 *    c. PAIR pricing with 1 requirement → must buy a pair for one eye.
 *       - If allowsSingleUnitOrder → can order single with optional surcharge.
 *       - If NOT → forced to buy pair, creating 1 surplus unit.
 * 4. CONSULT_REQUIRED verdicts produce a warning on the line.
 * 5. Minimum order units checked against group size.
 */
export function buildFulfillmentPlan(
	requirements: LensRequirement[],
	catalog: Map<string, CatalogItemForPlanning>,
	availableSurplus: SurplusUnitForPlanning[] = []
): FulfillmentPlanResult {
	const lines: FulfillmentPlanResultLine[] = [];
	const surplus: SurplusInfo[] = [];
	const groups = groupByCatalogItem(requirements);

	// Index surplus by catalog item for fast lookup
	const surplusPool = buildSurplusPool(availableSurplus);

	for (const group of groups) {
		const item = catalog.get(group.catalogItemId);
		if (!item) {
			throw new Error(`Catalog item not found: ${group.catalogItemId}`);
		}

		// Step 1: Try to fulfill from surplus
		const remaining = fulfillFromSurplus(group.requirements, surplusPool, lines);

		// Step 2: Handle remaining requirements through normal ordering
		if (remaining.length > 0) {
			const remainingGroup: RequirementGroup = {
				catalogItemId: group.catalogItemId,
				requirements: remaining
			};

			const policy = item.purchasePolicy;
			const isPairPricing = policy.listOrderUnit === LensPricingUnit.PAIR;

			if (isPairPricing) {
				planPairPricingGroup(remainingGroup, item, lines, surplus);
			} else {
				planUnitPricingGroup(remainingGroup, item, lines);
			}

			// Check minimum order units (only for ordered units, not surplus-fulfilled)
			if (remaining.length < policy.minimumOrderUnits) {
				for (const line of lines.filter(
					(l) =>
						l.catalogItemId === group.catalogItemId && l.source !== FulfillmentSource.SURPLUS_STOCK
				)) {
					if (!line.warnings.includes(FulfillmentWarningCode.BELOW_MINIMUM_ORDER)) {
						line.warnings.push(FulfillmentWarningCode.BELOW_MINIMUM_ORDER);
					}
				}
			}
		}
	}

	const totalCost = lines.reduce((sum, l) => sum + (l.cost?.totalCost ?? 0), 0);
	const requiresAnyConfirmation = lines.some((l) => l.requiresConfirmation);
	const allWarnings = [...new Set(lines.flatMap((l) => l.warnings))];

	return { lines, surplus, totalCost, requiresAnyConfirmation, allWarnings };
}

// ============================================================================
// SURPLUS FULFILLMENT
// ============================================================================

type SurplusPool = Map<string, SurplusUnitForPlanning[]>;

/** Build a mutable pool of surplus units indexed by catalog item */
function buildSurplusPool(surplus: SurplusUnitForPlanning[]): SurplusPool {
	const pool: SurplusPool = new Map();
	for (const unit of surplus) {
		const existing = pool.get(unit.catalogItemId);
		if (existing) {
			existing.push(unit);
		} else {
			pool.set(unit.catalogItemId, [unit]);
		}
	}
	return pool;
}

/**
 * Check if a surplus unit's prescription matches a requirement.
 * Compares sphere, cylinder, and addition — NOT axis (axis is a mounting concern).
 */
function prescriptionsMatch(
	a: { sphere: number | null; cylinder: number | null; addition: number | null },
	b: { sphere: number | null; cylinder: number | null; addition: number | null }
): boolean {
	return a.sphere === b.sphere && a.cylinder === b.cylinder && a.addition === b.addition;
}

/**
 * Check if two treatment arrays contain the same codes (order-independent).
 */
function treatmentsMatch(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	if (a.length === 0) return true;
	const setA = new Set(a);
	return b.every((code) => setA.has(code));
}

/**
 * Check if a surplus unit fully matches a requirement.
 * Requires: same catalogItemId (handled by pool), same prescription
 * (sphere, cylinder, addition — not axis), and same optional treatments.
 */
function surplusMatchesRequirement(surplus: SurplusUnitForPlanning, req: LensRequirement): boolean {
	return (
		prescriptionsMatch(surplus.prescription, req.prescription) &&
		treatmentsMatch(surplus.appliedOptionalTreatments, req.selectedOptionalTreatments)
	);
}

/**
 * Try to fulfill requirements from surplus stock.
 * Matching requires catalogItemId + prescription (sphere, cylinder, addition)
 * + identical optional treatments.
 * Consumed surplus units are removed from the pool.
 * Returns the requirements that could NOT be fulfilled from surplus.
 */
function fulfillFromSurplus(
	requirements: LensRequirement[],
	pool: SurplusPool,
	lines: FulfillmentPlanResultLine[]
): LensRequirement[] {
	const remaining: LensRequirement[] = [];
	const available = pool.get(requirements[0]?.catalogItemId ?? '') ?? [];

	for (const req of requirements) {
		const matchIndex = available.findIndex((u) => surplusMatchesRequirement(u, req));

		if (matchIndex !== -1) {
			const surplusUnit = available.splice(matchIndex, 1)[0]!;
			const warnings = buildWarnings(req, false, false);
			lines.push({
				requirementId: req.requirementId,
				eye: req.eye,
				catalogItemId: req.catalogItemId,
				source: FulfillmentSource.SURPLUS_STOCK,
				cost: zeroCost(),
				warnings,
				requiresConfirmation: warnings.includes(FulfillmentWarningCode.CONSULT_REQUIRED),
				surplusUnitId: surplusUnit.id
			});
		} else {
			remaining.push(req);
		}
	}

	return remaining;
}

/** Zero cost breakdown for surplus-fulfilled lines (already paid for) */
function zeroCost(): FulfillmentCostBreakdown {
	return {
		basePrice: 0,
		treatmentPrice: 0,
		surchargePrice: 0,
		mountingPrice: 0,
		shippingPrice: 0,
		totalCost: 0
	};
}

// ============================================================================
// UNIT PRICING STRATEGY
// ============================================================================

function planUnitPricingGroup(
	group: RequirementGroup,
	item: CatalogItemForPlanning,
	lines: FulfillmentPlanResultLine[]
): void {
	for (const req of group.requirements) {
		const warnings = buildWarnings(req, false, false);
		const cost = calculateLineCost(req, item, false);

		lines.push({
			requirementId: req.requirementId,
			eye: req.eye,
			catalogItemId: req.catalogItemId,
			source: FulfillmentSource.SUPPLIER_ORDER,
			cost,
			warnings,
			requiresConfirmation: warnings.includes(FulfillmentWarningCode.CONSULT_REQUIRED),
			surplusUnitId: null
		});
	}
}

// ============================================================================
// PAIR PRICING STRATEGY
// ============================================================================

/**
 * Build a key for sub-grouping requirements by "pair identity" —
 * matching prescription (sphere, cylinder, addition — not axis) + sorted treatments.
 */
function pairIdentityKey(req: LensRequirement): string {
	const rx = req.prescription;
	const treatments = [...req.selectedOptionalTreatments].sort().join(',');
	return `${rx.sphere}|${rx.cylinder}|${rx.addition}|${treatments}`;
}

/**
 * Sub-group requirements by prescription + treatments identity.
 * Only requirements with identical Rx + treatments can form a natural pair.
 */
function subGroupByPairIdentity(requirements: LensRequirement[]): LensRequirement[][] {
	const map = new Map<string, LensRequirement[]>();
	for (const req of requirements) {
		const key = pairIdentityKey(req);
		const existing = map.get(key);
		if (existing) {
			existing.push(req);
		} else {
			map.set(key, [req]);
		}
	}
	return Array.from(map.values());
}

function planPairPricingGroup(
	group: RequirementGroup,
	item: CatalogItemForPlanning,
	lines: FulfillmentPlanResultLine[],
	surplus: SurplusInfo[]
): void {
	const policy = item.purchasePolicy;

	if (policy.requiresSamePrescriptionForPair) {
		// Same-Rx supplier: sub-group by Rx+treatments, then process each sub-group
		const subGroups = subGroupByPairIdentity(group.requirements);
		for (const subGroup of subGroups) {
			if (subGroup.length >= 2) {
				planNaturalPairs(
					{ catalogItemId: group.catalogItemId, requirements: subGroup },
					item,
					lines
				);
			} else {
				// Single need in this Rx sub-group → forced pair, surplus Rx is predetermined
				planSingleUnitNeed(subGroup[0]!, item, policy, lines, surplus, true);
			}
		}
	} else {
		// Mixed-Rx allowed: any requirements can pair together
		if (group.requirements.length >= 2) {
			planNaturalPairs(group, item, lines);
		} else {
			planSingleUnitNeed(group.requirements[0]!, item, policy, lines, surplus, false);
		}
	}
}

/** Two requirements for the same item → natural pair */
function planNaturalPairs(
	group: RequirementGroup,
	item: CatalogItemForPlanning,
	lines: FulfillmentPlanResultLine[]
): void {
	// Process in pairs of 2
	for (let i = 0; i < group.requirements.length; i += 2) {
		const first = group.requirements[i]!;
		const second = group.requirements[i + 1];

		// First unit carries the pair cost
		const firstWarnings = buildWarnings(first, false, false);
		const firstCost = calculateLineCost(first, item, false);
		lines.push({
			requirementId: first.requirementId,
			eye: first.eye,
			catalogItemId: first.catalogItemId,
			source: FulfillmentSource.SUPPLIER_ORDER,
			cost: firstCost,
			warnings: firstWarnings,
			requiresConfirmation: firstWarnings.includes(FulfillmentWarningCode.CONSULT_REQUIRED),
			surplusUnitId: null
		});

		if (second) {
			// Second unit is bundled — its cost is included in the pair price
			const secondWarnings = buildWarnings(second, false, false);
			const secondCost = calculateLineCost(second, item, false);
			lines.push({
				requirementId: second.requirementId,
				eye: second.eye,
				catalogItemId: second.catalogItemId,
				source: FulfillmentSource.PAIR_BUNDLED,
				cost: secondCost,
				warnings: secondWarnings,
				requiresConfirmation: secondWarnings.includes(FulfillmentWarningCode.CONSULT_REQUIRED),
				surplusUnitId: null
			});
		} else {
			// Odd requirement out — treated as single unit need (shouldn't happen with 2, but handles 3+)
			// Already handled by first line
		}
	}
}

/**
 * One eye needs a lens but supplier sells by pair.
 * @param surplusRxPredetermined When true (same-Rx supplier), surplus Rx is identical
 *   to the requirement's Rx + treatments. When false, user decides at order time.
 */
function planSingleUnitNeed(
	req: LensRequirement,
	item: CatalogItemForPlanning,
	policy: CatalogItemForPlanning['purchasePolicy'],
	lines: FulfillmentPlanResultLine[],
	surplus: SurplusInfo[],
	surplusRxPredetermined: boolean
): void {
	if (policy.allowsSingleUnitOrder) {
		// Can order single unit — possibly with surcharge + confirmation
		const applySurcharge = policy.singleUnitSurcharge > 0;
		const needsConfirmation = policy.singleUnitRequiresConfirmation;
		const warnings = buildWarnings(req, applySurcharge, false);
		if (
			needsConfirmation &&
			!warnings.includes(FulfillmentWarningCode.SINGLE_UNIT_REQUIRES_CONFIRMATION)
		) {
			warnings.push(FulfillmentWarningCode.SINGLE_UNIT_REQUIRES_CONFIRMATION);
		}

		const cost = calculateLineCost(req, item, applySurcharge);

		lines.push({
			requirementId: req.requirementId,
			eye: req.eye,
			catalogItemId: req.catalogItemId,
			source: FulfillmentSource.SUPPLIER_ORDER,
			cost,
			warnings,
			requiresConfirmation:
				needsConfirmation || warnings.includes(FulfillmentWarningCode.CONSULT_REQUIRED),
			surplusUnitId: null
		});
	} else {
		// Must buy a pair — one unit is needed, one becomes surplus
		const warnings = buildWarnings(req, false, true);
		const cost = calculateLineCost(req, item, false);

		lines.push({
			requirementId: req.requirementId,
			eye: req.eye,
			catalogItemId: req.catalogItemId,
			source: FulfillmentSource.SUPPLIER_ORDER,
			cost,
			warnings,
			requiresConfirmation: warnings.includes(FulfillmentWarningCode.CONSULT_REQUIRED),
			surplusUnitId: null
		});

		// The surplus unit's cost is the same base + treatments (included in pair price)
		const surplusCost = calculateLineCost(req, item, false);
		surplus.push({
			catalogItemId: req.catalogItemId,
			sourceRequirementId: req.requirementId,
			surplusUnits: 1,
			surplusCostIncluded: surplusCost.totalCost,
			predeterminedPrescription: surplusRxPredetermined ? { ...req.prescription } : null,
			predeterminedTreatments: surplusRxPredetermined ? [...req.selectedOptionalTreatments] : null
		});
	}
}

// ============================================================================
// WARNING BUILDER
// ============================================================================

function buildWarnings(
	req: LensRequirement,
	hasSurcharge: boolean,
	createsSurplus: boolean
): FulfillmentWarningCode[] {
	const warnings: FulfillmentWarningCode[] = [];

	if (req.compatibilityVerdict === 'CONSULT_REQUIRED') {
		warnings.push(FulfillmentWarningCode.CONSULT_REQUIRED);
	}
	if (hasSurcharge) {
		warnings.push(FulfillmentWarningCode.SINGLE_UNIT_SURCHARGE);
	}
	if (createsSurplus) {
		warnings.push(FulfillmentWarningCode.PAIR_ORDER_CREATES_SURPLUS);
	}

	return warnings;
}
