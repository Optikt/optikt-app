/**
 * Optical range form types.
 * Split from utils/opticalRangeForm.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
export const SPHERE_RANGE_MODE = {
	CONTINUOUS: 'continuous',
	INVERSE_DUPLICATE: 'inverse-duplicate'
} as const;

export type SphereRangeMode = (typeof SPHERE_RANGE_MODE)[keyof typeof SPHERE_RANGE_MODE];

export type OpticalRangeFormEntry = {
	sphereMode: SphereRangeMode;
	inverseOuter: string;
	inverseInner: string;
	sphereMin: string;
	sphereMax: string;
	cylinderMin: string;
	cylinderMax: string;
	additionMin: string;
	additionMax: string;
};

export type ExpandedOpticalRange = {
	sphereMin: number;
	sphereMax: number;
	cylinderMin?: number;
	cylinderMax?: number;
	additionMin?: number;
	additionMax?: number;
};

export type OpticalRangeValidation = {
	sphere: string[];
	cylinder: string[];
	addition: string[];
};

export type OptionalBounds = {
	min?: number;
	max?: number;
};
