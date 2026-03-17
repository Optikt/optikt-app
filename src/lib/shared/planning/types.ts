import type {
	CoreLensTreatmentCode,
	LensPurchasePolicy,
	LensTreatmentPolicy
} from '$lib/shared/contracts/lenses';
import type { CompatibilityVerdict } from '$lib/shared/matching/types';

// ============================================================================
// Input types — what the planner receives
// ============================================================================

/** Which eye this requirement is for */
export type EyeSide = 'OD' | 'OS';

/**
 * A single lens need from a sale/quote.
 * Each eye produces one requirement when the user requests a lens pair.
 */
export interface LensRequirement {
	/** Unique id for this requirement (caller-provided) */
	requirementId: string;
	/** Which eye */
	eye: EyeSide;
	/** Resolved catalog item */
	catalogItemId: string;
	/** Compatibility verdict from matching engine */
	compatibilityVerdict: CompatibilityVerdict;
	/** Requested treatments that are OPTIONAL_EXTRA (not INHERENT) */
	selectedOptionalTreatments: CoreLensTreatmentCode[];
}

/**
 * Catalog item context the planner needs for costing/policy decisions.
 * Keyed by catalogItemId. Decoupled from DB types.
 */
export interface CatalogItemForPlanning {
	id: string;
	name: string;
	basePrice: number;
	purchasePolicy: LensPurchasePolicy;
	treatmentPolicies: LensTreatmentPolicy[];
}

// ============================================================================
// Output types — what the planner returns
// ============================================================================

/** How this lens unit will be sourced */
export type FulfillmentSource =
	| 'SUPPLIER_ORDER' // Standard order from supplier/lab
	| 'PAIR_BUNDLED'; // Covered as part of a pair purchase

/** Warning codes the UI can use for display */
export type PlanWarning =
	| 'CONSULT_REQUIRED' // Ranges not confirmed, must consult supplier
	| 'REQUIRES_SINGLE_UNIT_CONFIRMATION' // Supplier normally sells pairs, single unit needs confirmation
	| 'SINGLE_UNIT_SURCHARGE' // Extra cost for buying a single unit
	| 'CREATES_SURPLUS' // Buying a pair for one eye need, excess unit created
	| 'BELOW_MINIMUM_ORDER'; // Units needed < supplier minimum

/** Cost breakdown for a single plan line */
export interface LineCostBreakdown {
	/** Base lens price for one unit */
	baseUnitCost: number;
	/** Sum of additional treatment prices */
	treatmentsCost: number;
	/** Surcharge for single-unit order (0 if pair or not applicable) */
	singleUnitSurcharge: number;
	/** Mounting price from purchase policy */
	mountingCost: number;
	/** Shipping price from purchase policy */
	shippingCost: number;
	/** Total for this line = base + treatments + surcharge + mounting + shipping */
	lineTotal: number;
}

/** One line in the fulfillment plan — corresponds to one LensRequirement */
export interface FulfillmentPlanLine {
	/** Links back to the requirement */
	requirementId: string;
	eye: EyeSide;
	catalogItemId: string;

	/** How this unit is sourced */
	source: FulfillmentSource;

	/** Cost breakdown (null when bundled into a pair — cost lives on the pair's primary line) */
	cost: LineCostBreakdown | null;

	/** Human-readable warnings for the UI */
	warnings: PlanWarning[];

	/** Whether user must explicitly confirm before proceeding */
	requiresConfirmation: boolean;
}

/**
 * Information about surplus generated when buying a pair for a single-eye need.
 */
export interface SurplusInfo {
	/** Which catalog item generates the surplus */
	catalogItemId: string;
	/** How many surplus units this plan creates */
	surplusUnits: number;
	/** Cost of the surplus unit(s) — already included in the pair line's cost */
	surplusCostIncluded: number;
}

/** The complete fulfillment plan for a set of lens requirements */
export interface FulfillmentPlan {
	/** One line per requirement, in same order */
	lines: FulfillmentPlanLine[];
	/** Surplus generated (if any) */
	surplus: SurplusInfo[];
	/** Grand total across all lines */
	totalCost: number;
	/** Whether any line requires confirmation */
	requiresAnyConfirmation: boolean;
	/** All warnings across all lines (deduplicated) */
	allWarnings: PlanWarning[];
}
