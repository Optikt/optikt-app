/**
 * Pure validation + range evaluation for the shared lens editor.
 *
 * Field validation intentionally reuses the same Zod schemas the server applies
 * to `SaleItemSchema` / `QuoteItemSchema`, so a value that blocks here would
 * also block the remote save. Range warnings are advisory only.
 */
import {
	OptionalAdditionSchema,
	OptionalCylinderSchema,
	OptionalSphereSchema
} from '$lib/schemas/common/optical';
import { AlturaSchema, AxisSchema } from '$lib/schemas/prescriptions';
import { DiscountType } from '$lib/shared/enums';

import {
	evaluateLensRange,
	type LensRangeEvaluation,
	type OpticalRangeBounds
} from './opticalRange';
import type {
	LensEditorDraft,
	LensEditorEyeDraft,
	LensEditorFieldErrors,
	LensEditorTreatment
} from './types';

interface SchemaResult {
	success: boolean;
	error?: { issues: ReadonlyArray<{ message: string }> };
}

function firstIssue(result: SchemaResult): string | undefined {
	if (result.success) return undefined;
	return result.error?.issues[0]?.message;
}

function validateEye(
	prefix: 'od' | 'os',
	eye: LensEditorEyeDraft,
	requiresAddition: boolean
): Partial<LensEditorFieldErrors> {
	if (!eye.enabled) return {};

	const errors: Partial<LensEditorFieldErrors> = {};

	const sphere = firstIssue(OptionalSphereSchema.safeParse(eye.sphere ?? undefined));
	const cylinder = firstIssue(OptionalCylinderSchema.safeParse(eye.cylinder ?? undefined));
	const axis = firstIssue(AxisSchema.safeParse(eye.axis ?? undefined));
	const addition = firstIssue(OptionalAdditionSchema.safeParse(eye.addition ?? undefined));
	const altura = firstIssue(AlturaSchema.safeParse(eye.altura ?? undefined));

	const hasSphere = eye.sphere != null;
	const hasCylinder = eye.cylinder != null;
	const hasAxis = eye.axis != null;
	const hasSphereOrCylinder = hasSphere || hasCylinder;
	const missingSphereOrCylinder = !hasSphereOrCylinder;
	const missingAxis = hasCylinder && eye.cylinder !== 0 && !hasAxis;
	const missingAddition = requiresAddition && (eye.addition == null || eye.addition === 0);

	if (prefix === 'od') {
		if (sphere) errors.odSphere = sphere;
		if (cylinder) errors.odCylinder = cylinder;
		if (axis) errors.odAxis = axis;
		if (addition) errors.odAddition = addition;
		if (altura) errors.odAltura = altura;
		if (missingSphereOrCylinder) errors.odSphere = 'Esfera o cilindro requerido';
		if (missingAxis) errors.odAxis = 'Eje requerido con cilindro';
		if (missingAddition) errors.odAddition = 'Adición requerida';
	} else {
		if (sphere) errors.osSphere = sphere;
		if (cylinder) errors.osCylinder = cylinder;
		if (axis) errors.osAxis = axis;
		if (addition) errors.osAddition = addition;
		if (altura) errors.osAltura = altura;
		if (missingSphereOrCylinder) errors.osSphere = 'Esfera o cilindro requerido';
		if (missingAxis) errors.osAxis = 'Eje requerido con cilindro';
		if (missingAddition) errors.osAddition = 'Adición requerida';
	}

	return errors;
}

/** Blocking field errors for a lens draft (mirrors server item constraints). */
export function validateLensEditorDraft(
	draft: LensEditorDraft,
	options: { requiresAddition?: boolean } = {}
): LensEditorFieldErrors {
	const errors: LensEditorFieldErrors = {};
	const requiresAddition = options.requiresAddition ?? false;

	if (!draft.lensCatalogItemId) {
		errors.lensCatalogItemId = 'Seleccione un cristal';
	}
	if (!(draft.unitPrice > 0)) {
		errors.unitPrice = 'El precio debe ser mayor a 0';
	}
	if (!Number.isInteger(draft.quantity) || draft.quantity < 1) {
		errors.quantity = 'La cantidad debe ser al menos 1';
	}
	if (!((draft.discount ?? 0) >= 0)) {
		errors.discount = 'El descuento no puede ser negativo';
	}

	if (!draft.od.enabled && !draft.oi.enabled) {
		errors.prescription = 'Selecciona al menos un ojo';
	}

	Object.assign(
		errors,
		validateEye('od', draft.od, requiresAddition),
		validateEye('os', draft.oi, requiresAddition)
	);

	return errors;
}

export function hasLensEditorErrors(errors: LensEditorFieldErrors): boolean {
	return Object.values(errors).some((message) => Boolean(message));
}

/** Advisory optical-range evaluation for the current draft against the lens ranges. */
export function evaluateLensEditorRange(
	draft: LensEditorDraft,
	ranges: OpticalRangeBounds[]
): LensRangeEvaluation {
	return evaluateLensRange(
		[
			{
				eye: 'OD',
				enabled: draft.od.enabled,
				values: {
					sphere: draft.od.sphere,
					cylinder: draft.od.cylinder,
					axis: draft.od.axis,
					addition: draft.od.addition
				}
			},
			{
				eye: 'OI',
				enabled: draft.oi.enabled,
				values: {
					sphere: draft.oi.sphere,
					cylinder: draft.oi.cylinder,
					axis: draft.oi.axis,
					addition: draft.oi.addition
				}
			}
		],
		ranges
	);
}

function createEmptyLensEyeDraft(): LensEditorEyeDraft {
	return {
		enabled: true,
		sphere: null,
		cylinder: null,
		axis: null,
		addition: null,
		altura: null
	};
}

export function createEmptyLensEditorDraft(): LensEditorDraft {
	return {
		lensCatalogItemId: '',
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		od: createEmptyLensEyeDraft(),
		oi: createEmptyLensEyeDraft(),
		treatments: []
	};
}

export function treatmentTotal(treatments: LensEditorTreatment[]): number {
	return treatments.reduce((acc, treatment) => acc + treatment.salePrice * 2, 0);
}
