import type {
	CoreLensTreatmentCode,
	LensPurchasePolicy,
	LensTreatmentPolicy
} from '$lib/shared/contracts/lenses';
import type { PatientEye } from '$lib/shared/contracts/common';
import type { FulfillmentCostBreakdown } from '$lib/shared/contracts/fulfillment';
import type { CompatibilityVerdict } from '$lib/shared/matching/types';
import { FulfillmentSource, FulfillmentWarningCode } from '$lib/shared/contracts/fulfillment';

// Re-export enums so consumers can import from planning
export { FulfillmentSource, FulfillmentWarningCode };
export type { PatientEye, FulfillmentCostBreakdown };

// ============================================================================
// Input types — what the planner receives
// ============================================================================

/**
 * A single lens need from a sale/quote.
 * Each eye produces one requirement when the user requests a lens pair.
 */
export interface LensRequirement {
	/** Unique id for this requirement (caller-provided) */
	requirementId: string;
	/** Which eye */
	eye: PatientEye;
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

/** One line in the fulfillment plan result — corresponds to one LensRequirement */
export interface FulfillmentPlanResultLine {
	/** Links back to the requirement */
	requirementId: string;
	eye: PatientEye;
	catalogItemId: string;

	/** How this unit is sourced */
	source: FulfillmentSource;

	/** Cost breakdown (null when bundled into a pair — cost lives on the pair's primary line) */
	cost: FulfillmentCostBreakdown | null;

	/** Human-readable warnings for the UI */
	warnings: FulfillmentWarningCode[];

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

/** The complete fulfillment plan result for a set of lens requirements */
export interface FulfillmentPlanResult {
	/** One line per requirement, in same order */
	lines: FulfillmentPlanResultLine[];
	/** Surplus generated (if any) */
	surplus: SurplusInfo[];
	/** Grand total across all lines */
	totalCost: number;
	/** Whether any line requires confirmation */
	requiresAnyConfirmation: boolean;
	/** All warnings across all lines (deduplicated) */
	allWarnings: FulfillmentWarningCode[];
}
