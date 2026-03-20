import type { LensPricingUnit } from '$lib/shared/enums/lensTypes';
import type {
	CoreLensTreatmentCode,
	LensFinalSignature,
	LensPhysicalSignature,
	LensOrderedPrescription
} from './lenses';
import { PatientEye } from './common';

export enum FulfillmentSource {
	CATALOG_STOCK = 'CATALOG_STOCK',
	SURPLUS_STOCK = 'SURPLUS_STOCK',
	SUPPLIER_ORDER = 'SUPPLIER_ORDER',
	LAB_ORDER = 'LAB_ORDER',
	PAIR_BUNDLED = 'PAIR_BUNDLED'
}

export enum FulfillmentPlanningStatus {
	READY = 'READY',
	REQUIRES_CONFIRMATION = 'REQUIRES_CONFIRMATION',
	BLOCKED = 'BLOCKED'
}

export enum FulfillmentWarningCode {
	LOW_STOCK = 'LOW_STOCK',
	CONSULT_REQUIRED = 'CONSULT_REQUIRED',
	SINGLE_UNIT_REQUIRES_CONFIRMATION = 'SINGLE_UNIT_REQUIRES_CONFIRMATION',
	PAIR_ORDER_CREATES_SURPLUS = 'PAIR_ORDER_CREATES_SURPLUS',
	SINGLE_UNIT_SURCHARGE = 'SINGLE_UNIT_SURCHARGE',
	BELOW_MINIMUM_ORDER = 'BELOW_MINIMUM_ORDER',
	TREATMENT_NOT_AVAILABLE = 'TREATMENT_NOT_AVAILABLE',
	RANGE_NOT_PUBLISHED = 'RANGE_NOT_PUBLISHED'
}

export enum SurplusOriginType {
	SALE_PURCHASE_PAIR_EXCESS = 'SALE_PURCHASE_PAIR_EXCESS',
	MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT'
}

export enum SurplusUnitStatus {
	AVAILABLE = 'AVAILABLE',
	RESERVED = 'RESERVED',
	CONSUMED = 'CONSUMED',
	VOID = 'VOID'
}

/**
 * Patient's prescription for one eye — same shape as LensOrderedPrescription
 * but semantically represents the doctor's Rx rather than the ground formula.
 */
// TODO: consider unifying these types if the distinction isn't important in practice.
export type LensRequirementPrescription = LensOrderedPrescription;

export interface LensRequirementUnit {
	id: string;
	eye: PatientEye;
	signature: LensFinalSignature;
	prescription: LensRequirementPrescription;
}

export interface FulfillmentCostBreakdown {
	basePrice: number;
	treatmentPrice: number;
	mountingPrice: number;
	shippingPrice: number;
	surchargePrice: number;
	totalCost: number;
}

export interface FulfillmentPlanLine {
	id: string;
	requirementId: string;
	eye: PatientEye;
	status: FulfillmentPlanningStatus;
	source: FulfillmentSource;
	purchaseMode: LensPricingUnit;
	catalogItemId: string | null;
	surplusUnitId: string | null;
	usesExistingStock: boolean;
	requiresManualConfirmation: boolean;
	createsSurplusUnits: number;
	warnings: FulfillmentWarningCode[];
	cost: FulfillmentCostBreakdown;
	notes: string[];
}

export interface FulfillmentPlan {
	id: string;
	status: FulfillmentPlanningStatus;
	requirements: LensRequirementUnit[];
	lines: FulfillmentPlanLine[];
	selectedTreatments: CoreLensTreatmentCode[];
	summaryNotes: string[];
}

export interface SurplusUnitRecord {
	id: string;
	originType: SurplusOriginType;
	originSaleId: string | null;
	catalogItemId: string;
	supplierId: string;
	physicalSignature: LensPhysicalSignature;
	status: SurplusUnitStatus;
	costSnapshot: FulfillmentCostBreakdown;
	createdAtIso: string;
	consumedAtIso: string | null;
}
