/**
 * Shared helpers for sale wizard components (Step 2, Step 3, NewSaleForm).
 * Pure functions that operate on SaleItemRow + data arrays.
 */

import type { CompatibilityVerdict } from '$lib/shared/matching/types';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { SaleItemRow } from './newSaleTypes';
import { PatientEye } from '$lib/shared/contracts/common';
import type { LensRequirement } from '$lib/shared/planning';
import { LensType } from '$lib/shared/enums/lensTypes';
import { computeDiscount } from '$lib/utils';

// ============================================================================
// ITEM LOOKUPS
// ============================================================================

export function findProduct(
	item: SaleItemRow,
	products: ProductWithRelations[]
): ProductWithRelations | undefined {
	if (item.kind === 'product' && item.productId) {
		return products.find((p) => p.id === item.productId);
	}
	return undefined;
}

export function findLensItem(
	item: SaleItemRow,
	lensItems: LensCatalogItemWithRelations[]
): LensCatalogItemWithRelations | undefined {
	if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) return undefined;
	return lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
}

export function getItemName(
	item: SaleItemRow,
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): string {
	if (item.kind === 'product') {
		return findProduct(item, products)?.name ?? '—';
	}
	return findLensItem(item, lensItems)?.name ?? '—';
}

// ============================================================================
// PRICING
// ============================================================================

export function computeItemDiscount(item: SaleItemRow): number {
	const qty = item.kind === 'product' ? item.quantity : 1;
	const lineTotal = item.unitPrice * qty;
	return computeDiscount(item.discount, item.discountType, lineTotal);
}

export function itemLineTotal(item: SaleItemRow): number {
	const qty = item.kind === 'product' ? item.quantity : 1;
	return item.unitPrice * qty - computeItemDiscount(item);
}

// ============================================================================
// COMPATIBILITY VERDICT
// ============================================================================

/** Get the worst compatibility verdict across both eyes of a lens item */
export function getItemVerdict(item: SaleItemRow): CompatibilityVerdict | null {
	if (item.kind !== 'lens' || !item.lensPair) return null;
	const { od, oi } = item.lensPair;
	if (od.enabled && od.compatibilityVerdict === 'SIGNATURE_MISMATCH') return 'SIGNATURE_MISMATCH';
	if (oi.enabled && oi.compatibilityVerdict === 'SIGNATURE_MISMATCH') return 'SIGNATURE_MISMATCH';
	if (od.enabled && od.compatibilityVerdict === 'CONSULT_REQUIRED') return 'CONSULT_REQUIRED';
	if (oi.enabled && oi.compatibilityVerdict === 'CONSULT_REQUIRED') return 'CONSULT_REQUIRED';
	if (
		(od.enabled && od.compatibilityVerdict === 'EXACT_MATCH') ||
		(oi.enabled && oi.compatibilityVerdict === 'EXACT_MATCH')
	)
		return 'EXACT_MATCH';
	return null;
}

// ============================================================================
// VERDICT DISPLAY CONFIG
// ============================================================================

export interface VerdictDisplayConfig {
	label: string;
	shortLabel: string;
	borderColor: string;
	bgColor: string;
	badgeBgColor: string;
	textColor: string;
	desc: string;
}

export const VERDICT_DISPLAY: Record<CompatibilityVerdict, VerdictDisplayConfig> = {
	EXACT_MATCH: {
		label: 'Compatible',
		shortLabel: 'Compatible',
		borderColor: 'border-emerald-300',
		bgColor: 'bg-emerald-50',
		badgeBgColor: 'bg-emerald-100',
		textColor: 'text-emerald-700',
		desc: 'La fórmula del paciente está dentro del rango de este lente.'
	},
	CONSULT_REQUIRED: {
		label: 'Consultar Proveedor',
		shortLabel: 'Consultar',
		borderColor: 'border-amber-300',
		bgColor: 'bg-amber-50',
		badgeBgColor: 'bg-amber-100',
		textColor: 'text-amber-700',
		desc: 'El proveedor debe confirmar disponibilidad para esta fórmula.'
	},
	SIGNATURE_MISMATCH: {
		label: 'Incompatible',
		shortLabel: 'Incompatible',
		borderColor: 'border-red-300',
		bgColor: 'bg-red-50',
		badgeBgColor: 'bg-red-100',
		textColor: 'text-red-700',
		desc: 'La fórmula del paciente no es compatible con este lente.'
	}
};

// ============================================================================
// PLAN BRIDGE — Convert wizard state → LensRequirement[] for the planner
// ============================================================================

/**
 * Convert lens SaleItemRows into LensRequirement[] for the fulfillment planner.
 * One requirement per enabled eye per lens item.
 */
export function buildLensRequirements(items: SaleItemRow[]): LensRequirement[] {
	const reqs: LensRequirement[] = [];

	for (const item of items) {
		if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) continue;
		const pair = item.lensPair;

		const eyes = [
			{ flag: pair.od, eye: PatientEye.OD, suffix: 'od' },
			{ flag: pair.oi, eye: PatientEye.OI, suffix: 'oi' }
		] as const;

		for (const { flag, eye, suffix } of eyes) {
			if (!flag.enabled) continue;
			if (!flag.compatibilityVerdict) continue; // no verdict means no Rx entered yet

			reqs.push({
				requirementId: `${item.id}-${suffix}`,
				eye,
				catalogItemId: pair.catalogItemId,
				prescription: { ...flag.prescription },
				compatibilityVerdict: flag.compatibilityVerdict,
				selectedOptionalTreatments: [...pair.selectedOptionalTreatments]
			});
		}
	}

	return reqs;
}

// ============================================================================
// PRESCRIPTION VALIDATION
// ============================================================================

export interface PrescriptionFieldErrors {
	odSphere?: string;
	odCylinder?: string;
	odAxis?: string;
	odAddition?: string;
	oiSphere?: string;
	oiCylinder?: string;
	oiAxis?: string;
	oiAddition?: string;
}

/** Determine which eyes need Rx validation based on enabled lens items */
export function getRequiredEyes(items: SaleItemRow[]): { needsOd: boolean; needsOi: boolean } {
	let needsOd = false;
	let needsOi = false;
	for (const item of items) {
		if (item.kind === 'lens' && item.lensPair) {
			if (item.lensPair.od.enabled) needsOd = true;
			if (item.lensPair.oi.enabled) needsOi = true;
		}
	}
	return { needsOd, needsOi };
}

function validateEyeFields(
	sphere: string,
	cylinder: string,
	axis: string,
	addition: string,
	requiresAddition: boolean
): Record<string, string> {
	const errs: Record<string, string> = {};

	if (sphere === '' && cylinder === '') {
		errs.sphere = 'Esfera o cilindro requerido';
		errs.cylinder = 'Esfera o cilindro requerido';
	}

	const cyl = parseFloat(cylinder);
	if (!isNaN(cyl) && cyl !== 0 && axis === '') {
		errs.axis = 'Eje requerido con cilindro';
	}

	if (requiresAddition) {
		const add = parseFloat(addition);
		if (addition === '' || isNaN(add) || add === 0) {
			errs.addition = 'Adición requerida';
		}
	}

	return errs;
}

/** Validate prescription fields. Returns empty object when all valid. */
export function validatePrescriptionFields(
	values: {
		odSphere: string;
		odCylinder: string;
		odAxis: string;
		odAddition: string;
		oiSphere: string;
		oiCylinder: string;
		oiAxis: string;
		oiAddition: string;
		lensType: string;
	},
	needsOd: boolean,
	needsOi: boolean
): PrescriptionFieldErrors {
	const errors: PrescriptionFieldErrors = {};
	const requiresAddition = values.lensType !== LensType.MONOFOCAL;

	if (needsOd) {
		const od = validateEyeFields(
			values.odSphere,
			values.odCylinder,
			values.odAxis,
			values.odAddition,
			requiresAddition
		);
		if (od.sphere) errors.odSphere = od.sphere;
		if (od.cylinder) errors.odCylinder = od.cylinder;
		if (od.axis) errors.odAxis = od.axis;
		if (od.addition) errors.odAddition = od.addition;
	}

	if (needsOi) {
		const oi = validateEyeFields(
			values.oiSphere,
			values.oiCylinder,
			values.oiAxis,
			values.oiAddition,
			requiresAddition
		);
		if (oi.sphere) errors.oiSphere = oi.sphere;
		if (oi.cylinder) errors.oiCylinder = oi.cylinder;
		if (oi.axis) errors.oiAxis = oi.axis;
		if (oi.addition) errors.oiAddition = oi.addition;
	}

	return errors;
}

export function hasPrescriptionErrors(errors: PrescriptionFieldErrors): boolean {
	return Object.keys(errors).length > 0;
}
