import type { LensPricingUnit } from '$lib/shared/enums/lensTypes';
import type { CoreLensTreatmentCode, LensFinalSignature, LensPhysicalSignature } from './lenses';
import { PatientEye } from './common';

export enum FulfillmentSource {
	CATALOG_STOCK = 'CATALOG_STOCK',
	SURPLUS_STOCK = 'SURPLUS_STOCK',
	SUPPLIER_ORDER = 'SUPPLIER_ORDER',
	LAB_ORDER = 'LAB_ORDER'
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

export interface LensRequirementPrescription {
	sphere: number | null;
	cylinder: number | null;
	addition: number | null;
	axis: number | null;
}

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
