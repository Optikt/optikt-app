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
	lenses: LensCatalogItemWithRelations[]
): Record<string, string[]> {
	const warnings: Record<string, string[]> = {};

	for (const item of items) {
		if (item.itemType !== SaleItemType.LENS_PAIR || !item.id || !item.lensCatalogItemId) {
			continue;
		}
		const lens = lenses.find((candidate) => candidate.id === item.lensCatalogItemId);
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
	return {
		lensCatalogItemId: item.lensCatalogItemId ?? '',
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount ?? 0,
		discountType: (item.discountType ?? DiscountType.FIXED) as string,
		od: {
			sphere: item.odSphere ?? null,
			cylinder: item.odCylinder ?? null,
			axis: item.odAxis ?? null,
			addition: item.odAddition ?? null,
			altura: item.odAltura ?? null
		},
		oi: {
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
		discount: draft.discount,
		discountType: draft.discountType as DiscountTypeEnum,
		odSphere: draft.od.sphere ?? undefined,
		odCylinder: draft.od.cylinder ?? undefined,
		odAxis: draft.od.axis ?? undefined,
		odAddition: draft.od.addition ?? undefined,
		odAltura: draft.od.altura ?? undefined,
		osSphere: draft.oi.sphere ?? undefined,
		osCylinder: draft.oi.cylinder ?? undefined,
		osAxis: draft.oi.axis ?? undefined,
		osAddition: draft.oi.addition ?? undefined,
		osAltura: draft.oi.altura ?? undefined
	};
}
