/**
 * Sale adapter for the shared lens editor.
 *
 * Translates between the sale draft shape (`EditableItem` + edit treatments)
 * and the domain-agnostic `LensEditorDraft` consumed by `LensEditorPanel`.
 */
import { DiscountType } from '$lib/shared/enums';
import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
import type { LensEditorDraft, LensEditorTreatment } from '$lib/components/documentEditor/types';
import { evaluateLensRange } from '$lib/components/documentEditor/opticalRange';

import type { EditableItem, EditLensTreatment } from '../editSaleDraft';

export function lensEditorTreatmentsFromEdit(
	treatments: EditLensTreatment[]
): LensEditorTreatment[] {
	return treatments.map((treatment) => ({
		supplierTreatmentId: treatment.supplierTreatmentId,
		name: treatment.name,
		price: treatment.price,
		salePrice: treatment.salePrice,
		isTaxable: treatment.isTaxable,
		category: treatment.category
	}));
}

export function editTreatmentsFromLensEditor(
	treatments: LensEditorTreatment[]
): EditLensTreatment[] {
	return treatments.map((treatment) => ({
		supplierTreatmentId: treatment.supplierTreatmentId,
		name: treatment.name,
		price: treatment.price,
		salePrice: treatment.salePrice,
		isTaxable: treatment.isTaxable,
		category: treatment.category,
		_keep: true
	}));
}

/**
 * Keep only treatments that belong to the selected lens supplier.
 * `availableForSupplier` is the treatment list already filtered by the lens
 * supplier. When the supplier is unknown, treatments are left untouched.
 */
export function filterCompatibleTreatments(
	treatments: LensEditorTreatment[],
	availableForSupplier: { id: string }[],
	hasKnownSupplier: boolean
): LensEditorTreatment[] {
	if (!hasKnownSupplier) return treatments;
	const allowed = new Set(availableForSupplier.map((treatment) => treatment.id));
	return treatments.filter((treatment) => allowed.has(treatment.supplierTreatmentId));
}

export function collectLensRangeWarnings(
	items: EditableItem[],
	getLens: (id: string) => LensCatalogItemWithRelations | undefined
): Record<string, string[]> {
	const warnings: Record<string, string[]> = {};

	for (const item of items) {
		if (item.itemType !== SaleItemType.LENS_PAIR || !item.id || !item.lensCatalogItemId) {
			continue;
		}
		const lens = getLens(item.lensCatalogItemId);
		if (!lens || lens.ranges.length === 0) continue;

		const evaluation = evaluateLensRange(
			[
				{
					eye: 'OD',
					values: {
						sphere: item.odSphere,
						cylinder: item.odCylinder,
						axis: item.odAxis,
						addition: item.odAddition
					}
				},
				{
					eye: 'OI',
					values: {
						sphere: item.osSphere,
						cylinder: item.osCylinder,
						axis: item.osAxis,
						addition: item.osAddition
					}
				}
			],
			lens.ranges
		);

		if (evaluation.warnings.length > 0) {
			warnings[item.id] = evaluation.warnings;
		}
	}

	return warnings;
}

export function lensEditorDraftFromEditableItem(
	item: EditableItem,
	treatments: EditLensTreatment[] = []
): LensEditorDraft {
	const odHasValues = [
		item.odSphere,
		item.odCylinder,
		item.odAxis,
		item.odAddition,
		item.odAltura
	].some((value) => value != null);
	const oiHasValues = [
		item.osSphere,
		item.osCylinder,
		item.osAxis,
		item.osAddition,
		item.osAltura
	].some((value) => value != null);

	return {
		lensCatalogItemId: item.lensCatalogItemId ?? '',
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount ?? 0,
		discountType: (item.discountType ?? DiscountType.FIXED) as string,
		od: {
			enabled: odHasValues || !oiHasValues,
			sphere: item.odSphere ?? null,
			cylinder: item.odCylinder ?? null,
			axis: item.odAxis ?? null,
			addition: item.odAddition ?? null,
			altura: item.odAltura ?? null
		},
		oi: {
			enabled: oiHasValues || !odHasValues,
			sphere: item.osSphere ?? null,
			cylinder: item.osCylinder ?? null,
			axis: item.osAxis ?? null,
			addition: item.osAddition ?? null,
			altura: item.osAltura ?? null
		},
		treatments: lensEditorTreatmentsFromEdit(treatments)
	};
}

export function editableItemFromLensEditorDraft(
	base: EditableItem,
	draft: LensEditorDraft
): EditableItem {
	return {
		...base,
		itemType: SaleItemType.LENS_PAIR,
		lensCatalogItemId: draft.lensCatalogItemId || undefined,
		quantity: draft.quantity,
		unitPrice: draft.unitPrice,
		discount: draft.discount ?? 0,
		discountType: draft.discountType as DiscountTypeEnum,
		odSphere: draft.od.enabled ? (draft.od.sphere ?? undefined) : undefined,
		odCylinder: draft.od.enabled ? (draft.od.cylinder ?? undefined) : undefined,
		odAxis: draft.od.enabled ? (draft.od.axis ?? undefined) : undefined,
		odAddition: draft.od.enabled ? (draft.od.addition ?? undefined) : undefined,
		odAltura: draft.od.enabled ? (draft.od.altura ?? undefined) : undefined,
		osSphere: draft.oi.enabled ? (draft.oi.sphere ?? undefined) : undefined,
		osCylinder: draft.oi.enabled ? (draft.oi.cylinder ?? undefined) : undefined,
		osAxis: draft.oi.enabled ? (draft.oi.axis ?? undefined) : undefined,
		osAddition: draft.oi.enabled ? (draft.oi.addition ?? undefined) : undefined,
		osAltura: draft.oi.enabled ? (draft.oi.altura ?? undefined) : undefined
	};
}
