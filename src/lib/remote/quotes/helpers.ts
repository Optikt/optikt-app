/**
 * Quotes remote — shared builders
 * Split from quotes.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */

import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes';

import { ALL_LENS_TYPES, LensType, SaleItemType } from '$lib/shared/enums/lensTypes';

import { type SaleTotalsLine } from '$lib/shared/saleTotals';

import type { QuoteItemInput } from '$lib/schemas/quotes';
import type { PrescriptionFieldsInput } from '$lib/schemas/prescriptions';

import { computeLensSnapshotCostTotal, computeSnapshotCostUnit } from '$lib/shared/saleItemCosts';

// ============================================================================
// HELPERS
// ============================================================================

export function toSaleTotalsLine(
	item: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable?: boolean | null;
		itemType: string;
	},
	taxRate: number
): SaleTotalsLine {
	return {
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		discount: item.discount,
		discountType: item.discountType,
		isTaxable: item.snapshotIsTaxable ?? (item.itemType === SaleItemType.PRODUCT ? true : false),
		taxRate
	};
}

export function buildQuoteItemValues(item: QuoteItemInput, quoteId: string, now: string) {
	return {
		id: item.id ?? crypto.randomUUID(),
		quoteId,
		itemType: item.itemType,
		parentQuoteItemId: item.parentQuoteItemId ?? null,
		productId: item.productId ?? null,
		lensCatalogItemId: item.lensCatalogItemId ?? null,
		supplierTreatmentId: item.supplierTreatmentId ?? null,
		odSphere: item.odSphere ?? null,
		odCylinder: item.odCylinder ?? null,
		odAxis: item.odAxis ?? null,
		odAddition: item.odAddition ?? null,
		odAltura: item.odAltura ?? null,
		osSphere: item.osSphere ?? null,
		osCylinder: item.osCylinder ?? null,
		osAxis: item.osAxis ?? null,
		osAddition: item.osAddition ?? null,
		osAltura: item.osAltura ?? null,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: item.discountType,
		snapshotName: item.snapshotName ?? null,
		snapshotSku: item.snapshotSku ?? null,
		snapshotBrand: item.snapshotBrand ?? null,
		snapshotBaseCost: item.snapshotBaseCost ?? null,
		snapshotMountingPrice: item.snapshotMountingPrice ?? null,
		snapshotShippingPrice: item.snapshotShippingPrice ?? null,
		snapshotSalePrice: item.snapshotSalePrice ?? null,
		snapshotPriceType: item.snapshotPriceType ?? null,
		snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? null,
		snapshotIsTaxable: item.snapshotIsTaxable ?? null,
		notes: item.notes ?? null,
		createdAt: now,
		updatedAt: now
	};
}

export function resolveLensSnapshotCosts(item: {
	itemType: string;
	quantity: number;
	snapshotBaseCost?: number | null;
	snapshotMountingPrice?: number | null;
	snapshotShippingPrice?: number | null;
}): { snapshotCostTotal: number | null; snapshotCostUnit: number | null } {
	if (item.itemType !== SaleItemType.LENS_PAIR) {
		return { snapshotCostTotal: null, snapshotCostUnit: null };
	}

	const snapshotCostTotal = computeLensSnapshotCostTotal({
		snapshotBaseCost: item.snapshotBaseCost,
		snapshotMountingPrice: item.snapshotMountingPrice,
		snapshotShippingPrice: item.snapshotShippingPrice,
		shippingCostPending: false
	});

	return {
		snapshotCostTotal,
		snapshotCostUnit: computeSnapshotCostUnit(snapshotCostTotal, item.quantity)
	};
}

export function firstDefined<T>(values: Array<T | null | undefined>): T | undefined {
	return values.find((value): value is T => value != null);
}

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
	const osSphere = firstDefined(lensItems.map((item) => item.osSphere));
	const osCylinder = firstDefined(lensItems.map((item) => item.osCylinder));
	const osAxis = firstDefined(lensItems.map((item) => item.osAxis));
	const osAddition = firstDefined(lensItems.map((item) => item.osAddition));

	if (
		[odSphere, odCylinder, odAxis, odAddition, osSphere, osCylinder, osAxis, osAddition].every(
			(value) => value == null
		)
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
		osSphere,
		osCylinder,
		osAxis,
		osAddition,
		dp: undefined,
		npRight: undefined,
		npLeft: undefined,
		odAltura: undefined,
		osAltura: undefined,
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
