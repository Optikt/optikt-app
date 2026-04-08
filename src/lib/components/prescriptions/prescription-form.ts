import type { RemoteFormIssue } from '@sveltejs/kit';

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
		prescriptionDate: new Date().toISOString().slice(0, 10),
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
