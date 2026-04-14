import { formatAxis, formatOpticalValue } from '$lib/utils';

interface PrescriptionSnapshotSource {
	odSphere?: number | null;
	odCylinder?: number | null;
	odAxis?: number | null;
	odAddition?: number | null;
	osSphere?: number | null;
	osCylinder?: number | null;
	osAxis?: number | null;
	osAddition?: number | null;
}

type EyeSide = 'od' | 'os';

export function hasPrescriptionSnapshot(item: PrescriptionSnapshotSource): boolean {
	return [
		item.odSphere,
		item.odCylinder,
		item.odAxis,
		item.odAddition,
		item.osSphere,
		item.osCylinder,
		item.osAxis,
		item.osAddition
	].some((value) => value != null);
}

export function formatPrescriptionEye(
	item: PrescriptionSnapshotSource,
	eye: EyeSide
): string | null {
	const isRightEye = eye === 'od';
	const label = isRightEye ? 'OD' : 'OI';
	const sphere = isRightEye ? item.odSphere : item.osSphere;
	const cylinder = isRightEye ? item.odCylinder : item.osCylinder;
	const axis = isRightEye ? item.odAxis : item.osAxis;
	const addition = isRightEye ? item.odAddition : item.osAddition;

	const parts: string[] = [];

	if (sphere != null) parts.push(`ESF ${formatOpticalValue(sphere)}`);
	if (cylinder != null) parts.push(`CIL ${formatOpticalValue(cylinder)}`);
	if (axis != null) parts.push(`EJE ${formatAxis(axis)}`);
	if (addition != null) parts.push(`ADD ${formatOpticalValue(addition)}`);

	return parts.length > 0 ? `${label} ${parts.join(' · ')}` : null;
}
