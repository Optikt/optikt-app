import type { LensOrderedPrescription } from './lenses';
import { PatientEye } from './common';

/**
 * Patient's prescription for one eye — same shape as LensOrderedPrescription
 * but semantically represents the doctor's Rx rather than the ground formula.
 */
export type LensRequirementPrescription = LensOrderedPrescription;

export interface LensRequirementUnit {
	id: string;
	eye: PatientEye;
	prescription: LensRequirementPrescription;
}
