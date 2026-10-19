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

function validateEye(prefix: 'od' | 'os', eye: LensEditorEyeDraft): Partial<LensEditorFieldErrors> {
	const errors: Partial<LensEditorFieldErrors> = {};

	const sphere = firstIssue(OptionalSphereSchema.safeParse(eye.sphere ?? undefined));
	const cylinder = firstIssue(OptionalCylinderSchema.safeParse(eye.cylinder ?? undefined));
	const axis = firstIssue(AxisSchema.safeParse(eye.axis ?? undefined));
	const addition = firstIssue(OptionalAdditionSchema.safeParse(eye.addition ?? undefined));
	const altura = firstIssue(AlturaSchema.safeParse(eye.altura ?? undefined));

	if (prefix === 'od') {
		if (sphere) errors.odSphere = sphere;
		if (cylinder) errors.odCylinder = cylinder;
		if (axis) errors.odAxis = axis;
		if (addition) errors.odAddition = addition;
		if (altura) errors.odAltura = altura;
	} else {
		if (sphere) errors.osSphere = sphere;
		if (cylinder) errors.osCylinder = cylinder;
		if (axis) errors.osAxis = axis;
		if (addition) errors.osAddition = addition;
		if (altura) errors.osAltura = altura;
	}

	return errors;
}

/** Blocking field errors for a lens draft (mirrors server item constraints). */
export function validateLensEditorDraft(draft: LensEditorDraft): LensEditorFieldErrors {
	const errors: LensEditorFieldErrors = {};

	if (!draft.lensCatalogItemId) {
		errors.lensCatalogItemId = 'Seleccione un cristal';
	}
	if (!(draft.unitPrice > 0)) {
		errors.unitPrice = 'El precio debe ser mayor a 0';
	}
	if (!Number.isInteger(draft.quantity) || draft.quantity < 1) {
		errors.quantity = 'La cantidad debe ser al menos 1';
	}
	if (!(draft.discount >= 0)) {
		errors.discount = 'El descuento no puede ser negativo';
	}

	Object.assign(errors, validateEye('od', draft.od), validateEye('os', draft.oi));

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
				values: {
					sphere: draft.od.sphere,
					cylinder: draft.od.cylinder,
					axis: draft.od.axis,
					addition: draft.od.addition
				}
			},
			{
				eye: 'OI',
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
	return { sphere: null, cylinder: null, axis: null, addition: null, altura: null };
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
