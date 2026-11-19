/**
 * Quote helpers del servidor — builders puros compartidos por los cores de
 * quotes. Antes vivían en `$lib/remote/quotes/helpers` (inversión de capas,
 * deuda resuelta en el plan quotes-redesign).
 */

import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes/types';

import { ALL_LENS_TYPES, LensType, SaleItemType } from '$lib/shared/enums/lensTypes';

import type { QuoteItemInput } from '$lib/schemas/quotes';
import type { PrescriptionFieldsInput } from '$lib/schemas/prescriptions';

import { saleItemCommonValues } from '$lib/shared/saleItemValues';

export function buildQuoteItemValues(item: QuoteItemInput, quoteId: string, now: string) {
	return {
		id: item.id ?? crypto.randomUUID(),
		quoteId,
		parentQuoteItemId: item.parentQuoteItemId ?? null,
		...saleItemCommonValues(item),
		createdAt: now,
		updatedAt: now
	};
}

export function firstDefined<T>(values: Array<T | null | undefined>): T | undefined {
	return values.find((value): value is T => value != null);
}

/**
 * Deriva una prescripción de los ítems LENS_PAIR (primer valor definido por
 * campo, incluyendo la altura por ojo — mapeo corregido en el plan
 * quotes-redesign; antes `odAltura/osAltura` se descartaban).
 *
 * DEBT(multi-person-rx): un presupuesto puede llevar lentes de varias personas
 * (madre e hija). Hoy se deriva UNA prescripción con `firstDefined` sobre todos
 * los lentes y se marca `isCurrent` para el cliente titular — con varias
 * personas guarda una fórmula equivocada. Ver `docs/agents/quotes.md`
 * (Known gaps → fórmulas multi-persona).
 */
export function derivePrescriptionFromQuoteItems(
	items: QuoteItemWithDetails[],
	prescriptionDate: string
): PrescriptionFieldsInput | undefined {
	const lensItems = items.filter((item) => item.itemType === SaleItemType.LENS_PAIR);
	if (lensItems.length === 0) return undefined;

	const odSphere = firstDefined(lensItems.map((item) => item.odSphere));
	const odCylinder = firstDefined(lensItems.map((item) => item.odCylinder));
	const odAxis = firstDefined(lensItems.map((item) => item.odAxis));
	const odAddition = firstDefined(lensItems.map((item) => item.odAddition));
	const odAltura = firstDefined(lensItems.map((item) => item.odAltura));
	const osSphere = firstDefined(lensItems.map((item) => item.osSphere));
	const osCylinder = firstDefined(lensItems.map((item) => item.osCylinder));
	const osAxis = firstDefined(lensItems.map((item) => item.osAxis));
	const osAddition = firstDefined(lensItems.map((item) => item.osAddition));
	const osAltura = firstDefined(lensItems.map((item) => item.osAltura));

	if (
		[
			odSphere,
			odCylinder,
			odAxis,
			odAddition,
			odAltura,
			osSphere,
			osCylinder,
			osAxis,
			osAddition,
			osAltura
		].every((value) => value == null)
	) {
		return undefined;
	}

	const recommendedLensTypeCandidate = firstDefined(
		lensItems.map((item) => item.lensCatalogItem?.type)
	);
	const recommendedLensType = ALL_LENS_TYPES.includes(recommendedLensTypeCandidate as LensType)
		? (recommendedLensTypeCandidate as LensType)
		: LensType.MONOFOCAL;

	return {
		prescriptionDate,
		odSphere,
		odCylinder,
		odAxis,
		odAddition,
		odAltura,
		osSphere,
		osCylinder,
		osAxis,
		osAddition,
		osAltura,
		dp: undefined,
		npRight: undefined,
		npLeft: undefined,
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: undefined,
		recommendedLensType,
		notes: undefined,
		doctorName: '',
		isCurrent: true
	};
}
