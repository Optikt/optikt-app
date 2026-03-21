import { LensCatalogSource, LensPricingUnit, LensType } from '$lib/shared/enums/lensTypes';

export const CORE_LENS_TREATMENT_CODES = ['AR', 'BLUECUT'] as const;

export type CoreLensTreatmentCode = (typeof CORE_LENS_TREATMENT_CODES)[number];

export enum PhotochromicMode {
	NONE = 'NONE',
	INHERENT = 'INHERENT'
}

export enum LensTreatmentAvailability {
	INHERENT = 'INHERENT',
	OPTIONAL_EXTRA = 'OPTIONAL_EXTRA',
	NOT_AVAILABLE = 'NOT_AVAILABLE'
}

export enum LensRangeAvailability {
	EXACT_RANGES = 'EXACT_RANGES',
	CONSULT_REQUIRED = 'CONSULT_REQUIRED'
}

export interface LensTreatmentPolicy {
	code: CoreLensTreatmentCode;
	availability: LensTreatmentAvailability;
	additionalPrice: number;
	requiresConfirmation: boolean;
}

export function findTreatmentPolicy(policies: LensTreatmentPolicy[], code: CoreLensTreatmentCode) {
	return policies.find((p) => p.code === code);
}

export function createDefaultTreatmentPolicies(): LensTreatmentPolicy[] {
	return CORE_LENS_TREATMENT_CODES.map((code) => ({
		code,
		availability: LensTreatmentAvailability.NOT_AVAILABLE,
		additionalPrice: 0,
		requiresConfirmation: false
	}));
}

export interface LensPurchasePolicy {
	listOrderUnit: LensPricingUnit;
	/** When true, both lenses in a pair must have identical Rx + treatments */
	requiresSamePrescriptionForPair: boolean;
	allowsSingleUnitOrder: boolean;
	singleUnitRequiresConfirmation: boolean;
	singleUnitSurcharge: number;
	minimumOrderUnits: number;
	mountingPrice: number;
	shippingPrice: number;
}

export interface LensRequestSignature {
	lensType: LensType;
	materialId: string | null;
	photochromic: boolean;
	requiredTreatments: CoreLensTreatmentCode[];
}

export interface LensFinalSignature extends LensRequestSignature {
	catalogItemId: string;
	rangeAvailability: LensRangeAvailability;
}

export interface LensPhysicalSignature extends LensRequestSignature {
	originCatalogItemId: string;
	/** Exact ground prescription — the specific formula this physical lens was ordered with */
	prescription: LensOrderedPrescription;
}

/**
 * The exact prescription values a physical lens was ordered/ground with.
 * All fields nullable because not every lens type uses every parameter.
 */
export interface LensOrderedPrescription {
	sphere: number | null;
	cylinder: number | null;
	axis: number | null;
	addition: number | null;
}

export interface LensCatalogContract {
	id: string;
	supplierId: string;
	name: string;
	source: LensCatalogSource;
	lensType: LensType;
	materialId: string | null;
	brand: string | null;
	technology: string | null;
	photochromicMode: PhotochromicMode;
	rangeAvailability: LensRangeAvailability;
	treatmentPolicies: LensTreatmentPolicy[];
	purchasePolicy: LensPurchasePolicy;
	basePrice: number;
	isActive: boolean;
}

export interface LensCompatibilityEvaluation {
	requestedSignature: LensRequestSignature;
	offeringSignature: LensFinalSignature;
	matchesSignatureExactly: boolean;
	requiresRangeConsultation: boolean;
	unmatchedTreatments: CoreLensTreatmentCode[];
	extraTreatmentsNotRequested: CoreLensTreatmentCode[];
}

export const LENS_TREATMENT_LABELS: Record<CoreLensTreatmentCode, string> = {
	AR: 'Antirreflejo',
	BLUECUT: 'Bluecut'
};

export const PHOTOCHROMIC_MODE_LABELS: Record<PhotochromicMode, string> = {
	[PhotochromicMode.NONE]: 'No fotocromatico',
	[PhotochromicMode.INHERENT]: 'Fotocromatico'
};

export const LENS_TREATMENT_AVAILABILITY_LABELS: Record<LensTreatmentAvailability, string> = {
	[LensTreatmentAvailability.INHERENT]: 'Inherente',
	[LensTreatmentAvailability.OPTIONAL_EXTRA]: 'Extra opcional',
	[LensTreatmentAvailability.NOT_AVAILABLE]: 'No disponible'
};

export const LENS_RANGE_AVAILABILITY_LABELS: Record<LensRangeAvailability, string> = {
	[LensRangeAvailability.EXACT_RANGES]: 'Rangos exactos',
	[LensRangeAvailability.CONSULT_REQUIRED]: 'Consultar rango'
};
