import type { RemoteFormIssue } from '@sveltejs/kit';
import type { Prescription } from '$lib/server/db/schema';
import { dateToISODateString } from '$lib/utils';

export interface PrescriptionFormData {
	prescriptionDate: string;
	recommendedLensType: string;
	doctorName: string;
	isCurrent: boolean;
	odSphere: string;
	odCylinder: string;
	odAxis: string;
	odAddition: string;
	osSphere: string;
	osCylinder: string;
	osAxis: string;
	osAddition: string;
	dp: string;
	npRight: string;
	npLeft: string;
	altura: string;
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
		prescriptionDate: dateToISODateString(new Date()),
		recommendedLensType: '',
		doctorName: '',
		isCurrent: true,
		odSphere: '',
		odCylinder: '',
		odAxis: '',
		odAddition: '',
		osSphere: '',
		osCylinder: '',
		osAxis: '',
		osAddition: '',
		dp: '',
		npRight: '',
		npLeft: '',
		altura: '',
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
		prescriptionDate:
			prescription.prescriptionDate?.slice(0, 10) ?? dateToISODateString(new Date()),
		recommendedLensType: prescription.recommendedLensType ?? '',
		doctorName: prescription.doctorName ?? '',
		isCurrent: prescription.isCurrent,
		odSphere: toInputValue(prescription.odSphere),
		odCylinder: toInputValue(prescription.odCylinder),
		odAxis: toInputValue(prescription.odAxis),
		odAddition: toInputValue(prescription.odAddition),
		osSphere: toInputValue(prescription.osSphere),
		osCylinder: toInputValue(prescription.osCylinder),
		osAxis: toInputValue(prescription.osAxis),
		osAddition: toInputValue(prescription.osAddition),
		dp: toInputValue(prescription.dp),
		npRight: toInputValue(prescription.npRight),
		npLeft: toInputValue(prescription.npLeft),
		altura: toInputValue(prescription.altura),
		treatmentAntiReflective: prescription.treatments?.antiReflective ?? false,
		treatmentBlueBlock: prescription.treatments?.blueBlock ?? false,
		treatmentPhotochromic: prescription.treatments?.photochromic ?? false,
		treatmentOther: prescription.treatments?.other ?? '',
		notes: prescription.notes ?? ''
	};
}
