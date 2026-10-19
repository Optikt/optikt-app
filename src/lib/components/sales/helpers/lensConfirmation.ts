/**
 * Step 2 lens confirmation builders.
 * Pure functions that build the prescription confirmation state
 * (range warnings, lens type suggestions) for the sale wizard.
 *
 * Range evaluation itself lives in the shared `documentEditor/opticalRange`
 * module so sales, quotes and edit flows agree on the same rules.
 */

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import { getFreeItemCategoryLabel } from '$lib/shared/enums/lensTypes';

import {
	evaluateLensRange,
	type EyeKey,
	type EyeRangeStatus,
	type EyeRangeResult
} from '$lib/components/documentEditor/opticalRange';

import type { SaleItemRow, LensSaleItemRow, FreeSaleItemRow } from '../newSaleTypes';
import { findLensItem } from './items';

export type LensConfirmationEye = EyeKey;
export type LensConfirmationEyeStatus = EyeRangeStatus;

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

function toConfirmationEye(result: EyeRangeResult): LensConfirmationEyeResult {
	return {
		eye: result.eye,
		status: result.status,
		prescriptionSummary: result.prescriptionSummary,
		sphere: result.sphere,
		cylinder: result.cylinder,
		axis: result.axis,
		addition: result.addition
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

		const evaluation = evaluateLensRange(
			[
				{
					eye: 'OD',
					enabled: pair.od.enabled,
					values: {
						sphere: pair.od.prescription.sphere,
						cylinder: pair.od.prescription.cylinder,
						axis: pair.od.prescription.axis,
						addition: pair.od.prescription.addition
					}
				},
				{
					eye: 'OI',
					enabled: pair.oi.enabled,
					values: {
						sphere: pair.oi.prescription.sphere,
						cylinder: pair.oi.prescription.cylinder,
						axis: pair.oi.prescription.axis,
						addition: pair.oi.prescription.addition
					}
				}
			],
			ranges
		);

		return {
			itemId: item.id,
			lensName: lens?.name ?? 'Lente por seleccionar',
			catalogLensType: lens?.type ?? '',
			prescriptionLensType: pair.lensType,
			typeMatches: lens?.type === pair.lensType,
			hasRanges: evaluation.hasRanges,
			eyes: evaluation.eyes.map(toConfirmationEye),
			rangeWarnings: evaluation.warnings
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
