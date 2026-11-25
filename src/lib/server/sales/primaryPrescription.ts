/**
 * "Fórmula principal" (sales only): the Rx of ONE lens line becomes the
 * customer's current prescription. Without a primary lens nothing is created
 * or overwritten — a multi-person sale never stamps someone else's Rx on the
 * customer. Changing the primary creates a new current prescription; the old
 * one stays in the customer's history (unmarking deletes nothing).
 */
import {
	createPrescription,
	unsetCurrentPrescriptions,
	updatePrescription
} from '$lib/server/db/queries/customers';
import { setSaleItemPrescription } from '$lib/server/db/queries/sales/itemGroups';
import { getSalePrescription } from '$lib/server/db/queries/sales/reads';
import type { Prescription } from '$lib/server/db/schema/prescriptions';
import type { DbOrTx } from '$lib/server/db/types';
import { ALL_LENS_TYPES, LensType } from '$lib/shared/enums/lensTypes';
import { toPrescriptionInsert } from '$lib/utils/prescription';
import type { PrescriptionFieldsInput } from '$lib/schemas/prescriptions';

/** Rx snapshot carried by a LENS_PAIR line (sale or quote item). */
export interface LensRxSnapshot {
	odSphere: number | null;
	odCylinder: number | null;
	odAxis: number | null;
	odAddition: number | null;
	odAltura: number | null;
	osSphere: number | null;
	osCylinder: number | null;
	osAxis: number | null;
	osAddition: number | null;
	osAltura: number | null;
	dp?: number | null;
	npRight?: number | null;
	npLeft?: number | null;
}

const RX_KEYS = [
	'odSphere',
	'odCylinder',
	'odAxis',
	'odAddition',
	'odAltura',
	'osSphere',
	'osCylinder',
	'osAxis',
	'osAddition',
	'osAltura'
] as const;

/**
 * Prescription fields from ONE lens line (replaces the old `firstDefined`
 * derivation over every lens). Undefined when the line carries no Rx value.
 */
export function prescriptionFromLensLine(
	line: LensRxSnapshot,
	prescriptionDate: string,
	lensType?: string | null
): PrescriptionFieldsInput | undefined {
	if (RX_KEYS.every((key) => line[key] == null)) return undefined;

	const recommendedLensType = ALL_LENS_TYPES.includes(lensType as LensType)
		? (lensType as LensType)
		: LensType.MONOFOCAL;

	return {
		prescriptionDate,
		odSphere: line.odSphere ?? undefined,
		odCylinder: line.odCylinder ?? undefined,
		odAxis: line.odAxis ?? undefined,
		odAddition: line.odAddition ?? undefined,
		odAltura: line.odAltura ?? undefined,
		osSphere: line.osSphere ?? undefined,
		osCylinder: line.osCylinder ?? undefined,
		osAxis: line.osAxis ?? undefined,
		osAddition: line.osAddition ?? undefined,
		osAltura: line.osAltura ?? undefined,
		dp: line.dp ?? undefined,
		npRight: line.npRight ?? undefined,
		npLeft: line.npLeft ?? undefined,
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: undefined,
		recommendedLensType,
		notes: undefined,
		doctorName: '',
		isCurrent: true
	} as PrescriptionFieldsInput;
}

/** True when both carry the same graduation (sphere, cylinder, axis, addition, height). */
export function sameLensRx(a: LensRxSnapshot, b: LensRxSnapshot): boolean {
	return RX_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

/**
 * Creates the customer's new current prescription and links ONLY the primary
 * lens line to it. Other lens lines keep their own `prescriptionId`.
 */
export async function applyPrimaryPrescription(
	executor: DbOrTx,
	input: { customerId: string; saleItemId: string; fields: PrescriptionFieldsInput }
): Promise<Prescription> {
	await unsetCurrentPrescriptions(input.customerId, undefined, executor);
	const prescription = await createPrescription(
		{
			...toPrescriptionInsert(input.customerId, { ...input.fields, isCurrent: true }),
			// Doctor is optional when the Rx comes from a sale line (same as the conversion).
			doctorName: input.fields.doctorName || null
		},
		executor
	);
	await setSaleItemPrescription(input.saleItemId, prescription.id, executor);
	return prescription;
}

/**
 * Patches DP / nasal measures on the sale's linked prescription only when it
 * still belongs to the sale's current customer (never mutates a previous
 * customer's prescription).
 */
export async function patchSalePrescriptionMeasures(
	tx: DbOrTx,
	saleId: string,
	customerId: string,
	measures: { dp?: number | null; npRight?: number | null; npLeft?: number | null }
): Promise<Prescription | null> {
	const patch: Partial<Pick<Prescription, 'dp' | 'npRight' | 'npLeft'>> = {};
	for (const key of ['dp', 'npRight', 'npLeft'] as const) {
		if (measures[key] !== undefined) patch[key] = measures[key];
	}
	if (Object.keys(patch).length === 0) return null;

	const current = await getSalePrescription(saleId, tx);
	if (!current || current.customerId !== customerId) return null;
	return updatePrescription(current.id, patch, tx);
}
