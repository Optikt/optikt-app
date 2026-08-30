/**
 * Step 2 lens confirmation builders.
 * Pure functions that build the prescription confirmation state
 * (range warnings, lens type suggestions) for the sale wizard.
 */

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { getFreeItemCategoryLabel } from '$lib/shared/enums/lensTypes';

import type { SaleItemRow, LensSaleItemRow, FreeSaleItemRow } from '../newSaleTypes';
import { findLensItem } from './items';

export type LensConfirmationEye = 'OD' | 'OI';
export type LensConfirmationEyeStatus = 'in-range' | 'out-of-range' | 'lab-review';

export interface LensConfirmationEyeResult {
	eye: LensConfirmationEye;
	status: LensConfirmationEyeStatus;
	prescriptionSummary: string;
	sphere: number | null;
	cylinder: number | null;
	axis: number | null;
	addition: number | null;
}

export interface LensConfirmationItemResult {
	itemId: string;
	lensName: string;
	catalogLensType: string;
	prescriptionLensType: string;
	typeMatches: boolean;
	hasRanges: boolean;
	eyes: LensConfirmationEyeResult[];
	rangeWarnings: string[];
}

export interface FreeItemConfirmationResult {
	itemId: string;
	categoryLabel: string;
	description: string;
	unitPrice: number;
	hasCost: boolean;
}

export interface Step2PrescriptionConfirmation {
	hasLensItems: boolean;
	lensCount: number;
	hasMultipleLenses: boolean;
	items: LensConfirmationItemResult[];
	freeItems: FreeItemConfirmationResult[];
}

export interface LensTypeSuggestionState {
	catalogLensType: string | null;
	catalogLensTypes: string[];
	hasMixedCatalogLensTypes: boolean;
	conflictingPrescriptionLensType: string | null;
}

function parseNullablePrescriptionValue(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	if (value.trim() === '') return null;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableAdditionValue(value: string | number | null | undefined): number | null {
	const parsed = parseNullablePrescriptionValue(value);
	if (parsed === null || parsed === 0) return null;
	return parsed;
}

function parseNullableAxisValue(
	value: string | number | null | undefined,
	cylinder: number | null
): number | null {
	if (cylinder === null || cylinder === 0) return null;
	return parseNullablePrescriptionValue(value);
}

function formatSignedOpticalValue(value: number | null): string {
	if (value === null) return '-';
	return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function formatAxisValue(value: number | null): string {
	if (value === null) return '-';
	return `${Math.round(value)}°`;
}

function buildEyePrescriptionSummary(
	sphere: number | null,
	cylinder: number | null,
	axis: number | null,
	addition: number | null
): string {
	const parts = [`Esf ${formatSignedOpticalValue(sphere)}`];

	if (cylinder !== null && cylinder !== 0) {
		parts.push(`Cil ${formatSignedOpticalValue(cylinder)}`);
		parts.push(`Eje ${formatAxisValue(axis)}`);
	}

	if (addition !== null && addition !== 0) {
		parts.push(`Add ${formatSignedOpticalValue(addition)}`);
	}

	return parts.join(' / ');
}

function isWithinOpticalRange(
	value: number | null,
	min: number | null,
	max: number | null
): boolean {
	if (value === null) return true;
	if (min !== null && value < min) return false;
	if (max !== null && value > max) return false;
	return true;
}

function buildLensConfirmationEyeResult(
	eye: LensConfirmationEye,
	enabled: boolean,
	values: {
		sphere: string | number | null | undefined;
		cylinder: string | number | null | undefined;
		axis: string | number | null | undefined;
		addition: string | number | null | undefined;
	},
	ranges: LensCatalogItemWithRelations['ranges']
): LensConfirmationEyeResult | null {
	if (!enabled) return null;

	const sphere = parseNullablePrescriptionValue(values.sphere);
	const cylinder = parseNullablePrescriptionValue(values.cylinder);
	const axis = parseNullableAxisValue(values.axis, cylinder);
	const addition = parseNullableAdditionValue(values.addition);
	const prescriptionSummary = buildEyePrescriptionSummary(sphere, cylinder, axis, addition);

	if (ranges.length === 0) {
		return {
			eye,
			status: 'lab-review',
			prescriptionSummary,
			sphere,
			cylinder,
			axis,
			addition
		};
	}

	const fitsAnyRange = ranges.some((range) => {
		const sphereOk = isWithinOpticalRange(sphere, range.sphereMin, range.sphereMax);

		const cylinderOk =
			range.cylinderMin === null && range.cylinderMax === null
				? cylinder === null
				: isWithinOpticalRange(cylinder, range.cylinderMin ?? null, range.cylinderMax ?? null);

		const additionOk =
			range.additionMin === null && range.additionMax === null
				? addition === null
				: isWithinOpticalRange(addition, range.additionMin ?? null, range.additionMax ?? null);

		return sphereOk && cylinderOk && additionOk;
	});

	return {
		eye,
		status: fitsAnyRange ? 'in-range' : 'out-of-range',
		prescriptionSummary,
		sphere,
		cylinder,
		axis,
		addition
	};
}

export function buildStep2PrescriptionConfirmation(
	items: SaleItemRow[],
	lensItems: LensCatalogItemWithRelations[]
): Step2PrescriptionConfirmation {
	const lensResults = (
		items.filter(
			(item): item is LensSaleItemRow => item.kind === 'lens' && item.lensPair.catalogItemId !== ''
		) as LensSaleItemRow[]
	).map((item) => {
		const lens = findLensItem(item, lensItems);
		const ranges = lens?.ranges ?? [];
		const pair = item.lensPair;
		const eyes = [
			buildLensConfirmationEyeResult(
				'OD',
				pair.od.enabled,
				{
					sphere: pair.od.prescription.sphere,
					cylinder: pair.od.prescription.cylinder,
					axis: pair.od.prescription.axis,
					addition: pair.od.prescription.addition
				},
				ranges
			),
			buildLensConfirmationEyeResult(
				'OI',
				pair.oi.enabled,
				{
					sphere: pair.oi.prescription.sphere,
					cylinder: pair.oi.prescription.cylinder,
					axis: pair.oi.prescription.axis,
					addition: pair.oi.prescription.addition
				},
				ranges
			)
		].filter((result): result is LensConfirmationEyeResult => result !== null);

		const rangeWarnings = eyes
			.filter((eye) => eye.status === 'out-of-range')
			.map((eye) => `${eye.eye} (${eye.prescriptionSummary}) fuera del rango óptico del cristal`);

		return {
			itemId: item.id,
			lensName: lens?.name ?? 'Lente por seleccionar',
			catalogLensType: lens?.type ?? '',
			prescriptionLensType: pair.lensType,
			typeMatches: lens?.type === pair.lensType,
			hasRanges: ranges.length > 0,
			eyes,
			rangeWarnings
		};
	});

	const freeResults: FreeItemConfirmationResult[] = (
		items.filter((item): item is FreeSaleItemRow => item.kind === 'free') as FreeSaleItemRow[]
	).map((item) => ({
		itemId: item.id,
		categoryLabel: getFreeItemCategoryLabel(item.freeItem.category),
		description: item.freeItem.description,
		unitPrice: item.unitPrice,
		hasCost: item.freeItem.unitCost !== null && item.freeItem.unitCost > 0
	}));

	return {
		hasLensItems: lensResults.length > 0,
		lensCount: lensResults.length,
		hasMultipleLenses: lensResults.length > 1,
		items: lensResults,
		freeItems: freeResults
	};
}

export function getLensRangeWarningsForItem(
	itemId: string,
	confirmation: Step2PrescriptionConfirmation
): string[] {
	return confirmation.items.find((item) => item.itemId === itemId)?.rangeWarnings ?? [];
}

export function getLensTypeSuggestionState(
	items: SaleItemRow[],
	lensItems: LensCatalogItemWithRelations[],
	existingPrescriptionLensType?: string | null
): LensTypeSuggestionState {
	const catalogLensTypes = Array.from(
		new Set(
			items
				.filter((item) => item.kind === 'lens' && item.lensPair.catalogItemId !== '')
				.map((item) => findLensItem(item, lensItems)?.type ?? null)
				.filter((type): type is string => Boolean(type))
		)
	);

	const catalogLensType = catalogLensTypes.length === 1 ? catalogLensTypes[0] : null;

	return {
		catalogLensType,
		catalogLensTypes,
		hasMixedCatalogLensTypes: catalogLensTypes.length > 1,
		conflictingPrescriptionLensType:
			catalogLensType &&
			existingPrescriptionLensType &&
			existingPrescriptionLensType !== catalogLensType
				? existingPrescriptionLensType
				: null
	};
}
