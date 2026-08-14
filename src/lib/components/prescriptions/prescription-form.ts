import type { RemoteFormIssue } from '@sveltejs/kit';
import type { Prescription } from '$lib/server/db/schema';
import { fromISODate, nowUTC, toISODate } from '$lib/dates';

export interface PrescriptionFormData {
	prescriptionDate: string;
	recommendedLensType: string;
	doctorName: string;
	isCurrent: boolean;
	odSphere: string;
	odCylinder: string;
	odAxis: string;
	odAddition: string;
	odAltura: string;
	osSphere: string;
	osCylinder: string;
	osAxis: string;
	osAddition: string;
	osAltura: string;
	dp: string;
	npRight: string;
	npLeft: string;
	treatmentAntiReflective: boolean;
	treatmentBlueBlock: boolean;
	treatmentPhotochromic: boolean;
	treatmentOther: string;
	notes: string;
}

export type PrescriptionFormFieldName = keyof PrescriptionFormData;

export interface PrescriptionFieldIssueAccessor {
	issues?: () => RemoteFormIssue[] | undefined;
}

export type PrescriptionFieldIssues = Partial<
	Record<PrescriptionFormFieldName, PrescriptionFieldIssueAccessor>
>;

export function createPrescriptionFormData(): PrescriptionFormData {
	return {
		prescriptionDate: toISODate(nowUTC()),
		recommendedLensType: '',
		doctorName: '',
		isCurrent: true,
		odSphere: '',
		odCylinder: '',
		odAxis: '',
		odAddition: '',
		odAltura: '',
		osSphere: '',
		osCylinder: '',
		osAxis: '',
		osAddition: '',
		osAltura: '',
		dp: '',
		npRight: '',
		npLeft: '',
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: '',
		notes: ''
	};
}

function toInputValue(value: number | null | undefined): string {
	if (value === null || value === undefined) return '';
	return String(value);
}

export function prescriptionToFormData(prescription: Prescription): PrescriptionFormData {
	return {
		prescriptionDate: toISODate(fromISODate(prescription.prescriptionDate)) || toISODate(nowUTC()),
		recommendedLensType: prescription.recommendedLensType ?? '',
		doctorName: prescription.doctorName ?? '',
		isCurrent: prescription.isCurrent,
		odSphere: toInputValue(prescription.odSphere),
		odCylinder: toInputValue(prescription.odCylinder),
		odAxis: toInputValue(prescription.odAxis),
		odAddition: toInputValue(prescription.odAddition),
		odAltura: toInputValue(prescription.odAltura),
		osSphere: toInputValue(prescription.osSphere),
		osCylinder: toInputValue(prescription.osCylinder),
		osAxis: toInputValue(prescription.osAxis),
		osAddition: toInputValue(prescription.osAddition),
		osAltura: toInputValue(prescription.osAltura),
		dp: toInputValue(prescription.dp),
		npRight: toInputValue(prescription.npRight),
		npLeft: toInputValue(prescription.npLeft),
		treatmentAntiReflective: prescription.treatments?.antiReflective ?? false,
		treatmentBlueBlock: prescription.treatments?.blueBlock ?? false,
		treatmentPhotochromic: prescription.treatments?.photochromic ?? false,
		treatmentOther: prescription.treatments?.other ?? '',
		notes: prescription.notes ?? ''
	};
}
