import type {
	CoreLensTreatmentCode,
	LensOrderedPrescription,
	LensPurchasePolicy,
	LensTreatmentPolicy
} from '$lib/shared/contracts/lenses';
export type { CoreLensTreatmentCode };
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
	/** The exact prescription for this eye (sphere, cylinder, axis, addition) */
	prescription: LensOrderedPrescription;
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

/**
 * An available surplus unit the planner can use instead of ordering new.
 * Matching requires catalogItemId + prescription (sphere, cylinder, addition — not axis)
 * + identical optional treatments applied.
 */
export interface SurplusUnitForPlanning {
	/** The surplus unit's DB id */
	id: string;
	/** Which catalog item this surplus matches */
	catalogItemId: string;
	/** The exact prescription this surplus unit was ground with */
	prescription: LensOrderedPrescription;
	/** Optional treatments physically applied to this lens (e.g. AR, BLUECUT) */
	appliedOptionalTreatments: CoreLensTreatmentCode[];
	/** Cost snapshot from when the surplus was created (already paid) */
	costSnapshot: FulfillmentCostBreakdown;
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

	/** If sourced from surplus, reference to the surplus unit */
	surplusUnitId: string | null;
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
	/**
	 * When the supplier requires same-Rx pairs, the surplus prescription is
	 * predetermined (identical to the used lens). Null when user decides the Rx.
	 */
	predeterminedPrescription: LensOrderedPrescription | null;
	/**
	 * When the surplus prescription is predetermined, the treatments applied.
	 * Null when user decides.
	 */
	predeterminedTreatments: CoreLensTreatmentCode[] | null;
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
