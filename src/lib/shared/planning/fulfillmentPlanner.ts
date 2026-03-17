import { LensPricingUnit } from '$lib/shared/enums/lensTypes';
import { LensTreatmentAvailability } from '$lib/shared/contracts/lenses';
import type {
	LensRequirement,
	CatalogItemForPlanning,
	FulfillmentPlan,
	FulfillmentPlanLine,
	LineCostBreakdown,
	SurplusInfo,
	PlanWarning
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
): LineCostBreakdown {
	const baseUnitCost = item.basePrice;

	let treatmentsCost = 0;
	for (const code of requirement.selectedOptionalTreatments) {
		const policy = item.treatmentPolicies.find((p) => p.code === code);
		if (policy && policy.availability === LensTreatmentAvailability.OPTIONAL_EXTRA) {
			treatmentsCost += policy.additionalPrice;
		}
	}

	const singleUnitSurcharge = applySingleUnitSurcharge
		? item.purchasePolicy.singleUnitSurcharge
		: 0;

	const mountingCost = item.purchasePolicy.mountingPrice;
	const shippingCost = item.purchasePolicy.shippingPrice;

	return {
		baseUnitCost,
		treatmentsCost,
		singleUnitSurcharge,
		mountingCost,
		shippingCost,
		lineTotal: baseUnitCost + treatmentsCost + singleUnitSurcharge + mountingCost + shippingCost
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
 * 2. For each group, check the item's purchase policy:
 *    a. UNIT pricing → each requirement is an independent order line.
 *    b. PAIR pricing with 2 requirements → natural pair, one cost covers both.
 *    c. PAIR pricing with 1 requirement → must buy a pair for one eye.
 *       - If allowsSingleUnitOrder → can order single with optional surcharge.
 *       - If NOT → forced to buy pair, creating 1 surplus unit.
 * 3. CONSULT_REQUIRED verdicts produce a warning on the line.
 * 4. Minimum order units checked against group size.
 */
export function buildFulfillmentPlan(
	requirements: LensRequirement[],
	catalog: Map<string, CatalogItemForPlanning>
): FulfillmentPlan {
	const lines: FulfillmentPlanLine[] = [];
	const surplus: SurplusInfo[] = [];
	const groups = groupByCatalogItem(requirements);

	for (const group of groups) {
		const item = catalog.get(group.catalogItemId);
		if (!item) {
			throw new Error(`Catalog item not found: ${group.catalogItemId}`);
		}

		const policy = item.purchasePolicy;
		const isPairPricing = policy.listOrderUnit === LensPricingUnit.PAIR;
		const unitCount = group.requirements.length;

		if (isPairPricing) {
			planPairPricingGroup(group, item, lines, surplus);
		} else {
			planUnitPricingGroup(group, item, lines);
		}

		// Check minimum order units
		if (unitCount < policy.minimumOrderUnits) {
			for (const line of lines.filter((l) => l.catalogItemId === group.catalogItemId)) {
				if (!line.warnings.includes('BELOW_MINIMUM_ORDER')) {
					line.warnings.push('BELOW_MINIMUM_ORDER');
				}
			}
		}
	}

	const totalCost = lines.reduce((sum, l) => sum + (l.cost?.lineTotal ?? 0), 0);
	const requiresAnyConfirmation = lines.some((l) => l.requiresConfirmation);
	const allWarnings = [...new Set(lines.flatMap((l) => l.warnings))];

	return { lines, surplus, totalCost, requiresAnyConfirmation, allWarnings };
}

// ============================================================================
// UNIT PRICING STRATEGY
// ============================================================================

function planUnitPricingGroup(
	group: RequirementGroup,
	item: CatalogItemForPlanning,
	lines: FulfillmentPlanLine[]
): void {
	for (const req of group.requirements) {
		const warnings = buildWarnings(req, false, false);
		const cost = calculateLineCost(req, item, false);

		lines.push({
			requirementId: req.requirementId,
			eye: req.eye,
			catalogItemId: req.catalogItemId,
			source: 'SUPPLIER_ORDER',
			cost,
			warnings,
			requiresConfirmation: warnings.includes('CONSULT_REQUIRED')
		});
	}
}

// ============================================================================
// PAIR PRICING STRATEGY
// ============================================================================

function planPairPricingGroup(
	group: RequirementGroup,
	item: CatalogItemForPlanning,
	lines: FulfillmentPlanLine[],
	surplus: SurplusInfo[]
): void {
	const policy = item.purchasePolicy;
	const unitCount = group.requirements.length;

	if (unitCount >= 2) {
		// Natural pair(s) — process in pairs
		planNaturalPairs(group, item, lines);
	} else {
		// Single unit need with pair pricing
		planSingleUnitNeed(group.requirements[0]!, item, policy, lines, surplus);
	}
}

/** Two requirements for the same item → natural pair */
function planNaturalPairs(
	group: RequirementGroup,
	item: CatalogItemForPlanning,
	lines: FulfillmentPlanLine[]
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
			source: 'SUPPLIER_ORDER',
			cost: firstCost,
			warnings: firstWarnings,
			requiresConfirmation: firstWarnings.includes('CONSULT_REQUIRED')
		});

		if (second) {
			// Second unit is bundled — its cost is included in the pair price
			const secondWarnings = buildWarnings(second, false, false);
			const secondCost = calculateLineCost(second, item, false);
			lines.push({
				requirementId: second.requirementId,
				eye: second.eye,
				catalogItemId: second.catalogItemId,
				source: 'PAIR_BUNDLED',
				cost: secondCost,
				warnings: secondWarnings,
				requiresConfirmation: secondWarnings.includes('CONSULT_REQUIRED')
			});
		} else {
			// Odd requirement out — treated as single unit need (shouldn't happen with 2, but handles 3+)
			// Already handled by first line
		}
	}
}

/** One eye needs a lens but supplier sells by pair */
function planSingleUnitNeed(
	req: LensRequirement,
	item: CatalogItemForPlanning,
	policy: CatalogItemForPlanning['purchasePolicy'],
	lines: FulfillmentPlanLine[],
	surplus: SurplusInfo[]
): void {
	if (policy.allowsSingleUnitOrder) {
		// Can order single unit — possibly with surcharge + confirmation
		const applySurcharge = policy.singleUnitSurcharge > 0;
		const needsConfirmation = policy.singleUnitRequiresConfirmation;
		const warnings = buildWarnings(req, applySurcharge, false);
		if (needsConfirmation && !warnings.includes('REQUIRES_SINGLE_UNIT_CONFIRMATION')) {
			warnings.push('REQUIRES_SINGLE_UNIT_CONFIRMATION');
		}

		const cost = calculateLineCost(req, item, applySurcharge);

		lines.push({
			requirementId: req.requirementId,
			eye: req.eye,
			catalogItemId: req.catalogItemId,
			source: 'SUPPLIER_ORDER',
			cost,
			warnings,
			requiresConfirmation: needsConfirmation || warnings.includes('CONSULT_REQUIRED')
		});
	} else {
		// Must buy a pair — one unit is needed, one becomes surplus
		const warnings = buildWarnings(req, false, true);
		const cost = calculateLineCost(req, item, false);

		lines.push({
			requirementId: req.requirementId,
			eye: req.eye,
			catalogItemId: req.catalogItemId,
			source: 'SUPPLIER_ORDER',
			cost,
			warnings,
			requiresConfirmation: warnings.includes('CONSULT_REQUIRED')
		});

		// The surplus unit's cost is the same base + treatments (included in pair price)
		const surplusCost = calculateLineCost(req, item, false);
		surplus.push({
			catalogItemId: req.catalogItemId,
			surplusUnits: 1,
			surplusCostIncluded: surplusCost.lineTotal
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
): PlanWarning[] {
	const warnings: PlanWarning[] = [];

	if (req.compatibilityVerdict === 'CONSULT_REQUIRED') {
		warnings.push('CONSULT_REQUIRED');
	}
	if (hasSurcharge) {
		warnings.push('SINGLE_UNIT_SURCHARGE');
	}
	if (createsSurplus) {
		warnings.push('CREATES_SURPLUS');
	}

	return warnings;
}
