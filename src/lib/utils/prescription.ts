import type { PrescriptionTreatments, NewPrescription } from '$lib/server/db/schema';
import type { PrescriptionFieldsInput } from '$lib/schemas/prescriptions';

/**
 * Normalize optical values for storage.
 * Converts 0 to null for consistency in the database.
 * This allows distinguishing between "not measured" and "measured as 0" during validation,
 * but normalizes to null for storage to keep data consistent.
 */
export function normalizeOpticalValue(value: number | undefined | null): number | null {
	if (value === undefined || value === null) return null;
	return value === 0 ? null : value;
}

/**
 * Build treatments object from form data.
 */
export function buildTreatments(data: {
	treatmentAntiReflective?: boolean;
	treatmentBlueBlock?: boolean;
	treatmentPhotochromic?: boolean;
	treatmentOther?: string;
}): PrescriptionTreatments | null {
	const hasAnyTreatment =
		data.treatmentAntiReflective ||
		data.treatmentBlueBlock ||
		data.treatmentPhotochromic ||
		data.treatmentOther;

	if (!hasAnyTreatment) return null;

	return {
		antiReflective: data.treatmentAntiReflective ?? false,
		blueBlock: data.treatmentBlueBlock ?? false,
		photochromic: data.treatmentPhotochromic ?? false,
		other: data.treatmentOther ?? null
	};
}

/**
 * Convert validated prescription fields into a NewPrescription insert object.
 * Centralizes optical-value normalization and treatment building so callers
 * don't duplicate the mapping.
 */
export function toPrescriptionInsert(
	customerId: string,
	data: PrescriptionFieldsInput
): Omit<NewPrescription, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		customerId,
		prescriptionDate: data.prescriptionDate,
		odSphere: normalizeOpticalValue(data.odSphere),
		odCylinder: normalizeOpticalValue(data.odCylinder),
		odAxis: normalizeOpticalValue(data.odAxis),
		odAddition: normalizeOpticalValue(data.odAddition),
		osSphere: normalizeOpticalValue(data.osSphere),
		osCylinder: normalizeOpticalValue(data.osCylinder),
		osAxis: normalizeOpticalValue(data.osAxis),
		osAddition: normalizeOpticalValue(data.osAddition),
		dp: data.dp ?? null,
		npRight: data.npRight ?? null,
		npLeft: data.npLeft ?? null,
		altura: data.altura ?? null,
		treatments: buildTreatments(data),
		recommendedLensType: data.recommendedLensType ?? null,
		notes: data.notes ?? null,
		doctorName: data.doctorName ?? null,
		isCurrent: data.isCurrent ?? false
	};
}
