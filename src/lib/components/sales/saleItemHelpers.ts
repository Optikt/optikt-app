/**
 * Shared helpers for sale wizard components (Step 2, Step 3, NewSaleForm).
 * Pure functions that operate on SaleItemRow + data arrays.
 */

import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { SaleItemRow } from './newSaleTypes';
import { LensType } from '$lib/shared/enums/lensTypes';
import { computeDiscount } from '$lib/utils';
import { decomposePrice, type TaxableItem } from '$lib/shared/tax';

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

// ============================================================================
// EYE COUNT
// ============================================================================

/** Get the number of enabled eyes for a lens item. */
export function getEnabledEyeCount(item: SaleItemRow): number {
	if (!item.lensPair) return 0;
	return (item.lensPair.od.enabled ? 1 : 0) + (item.lensPair.oi.enabled ? 1 : 0);
}

// ============================================================================
// TAX HELPERS
// ============================================================================

/** Build TaxableItem[] from wizard items for use with computeTaxBreakdown. */
export function buildTaxItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): TaxableItem[] {
	const result: TaxableItem[] = [];
	for (const item of items) {
		if (item.kind === 'product') {
			const product = products.find((p) => p.id === item.productId);
			result.push({
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: product?.isTaxable ?? true,
				taxRate: product?.taxRate ?? 16
			});
		} else if (item.kind === 'lens') {
			const lens = lensItems.find((l) => l.id === item.lensPair?.catalogItemId);
			result.push({
				unitPrice: item.unitPrice,
				quantity: 1,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: lens?.isTaxable ?? false,
				taxRate: lens?.taxRate ?? 16
			});
			const eyeCount = getEnabledEyeCount(item);
			for (const t of item.treatments) {
				result.push({
					unitPrice: t.price,
					quantity: eyeCount,
					discount: 0,
					discountType: 'FIXED',
					isTaxable: t.isTaxable,
					taxRate: t.taxRate
				});
			}
		}
	}
	return result;
}

/** Compute tax breakdown from stored snapshot fields on persisted items. */
export function computeSnapshotTaxBreakdown(
	items: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable: boolean | null;
		snapshotTaxRate: number | null;
	}[]
): { taxableBase: number; exemptTotal: number; taxAmount: number } {
	let taxableBase = 0;
	let exemptTotal = 0;
	let taxAmount = 0;

	for (const item of items) {
		const lineTotal =
			item.unitPrice * item.quantity -
			computeDiscount(item.discount, item.discountType, item.unitPrice * item.quantity);
		const isTaxable = item.snapshotIsTaxable ?? false;
		const taxRate = item.snapshotTaxRate ?? 0;

		if (isTaxable && taxRate > 0) {
			const { base, tax } = decomposePrice(lineTotal, taxRate);
			taxableBase += base;
			taxAmount += tax;
		} else {
			exemptTotal += lineTotal;
		}
	}

	return { taxableBase, exemptTotal, taxAmount };
}
