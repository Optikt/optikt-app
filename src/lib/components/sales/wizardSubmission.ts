import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { QuoteItemInput } from '$lib/schemas/quotes';
import { PrescriptionFieldsSchema } from '$lib/schemas/prescriptions';
import type { SaleItemInput } from '$lib/schemas/sales';
import { LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { z } from 'zod';

import type { LensSaleItemRow, SaleItemRow } from './newSaleTypes';
import { getEnabledEyeCount } from './saleItemHelpers';

type PrescriptionFieldsPayload = z.input<typeof PrescriptionFieldsSchema>;

function buildLensPairItemBase(item: SaleItemRow, lensItems: LensCatalogItemWithRelations[]) {
	if (item.kind !== 'lens' || !item.lensPair) return null;

	const lens = lensItems.find((candidate) => candidate.id === item.lensPair?.catalogItemId);
	const eyeCount = getEnabledEyeCount(item);
	if (eyeCount === 0) return null;

	return {
		lens,
		eyeCount,
		snapshotName: lens?.name,
		snapshotBrand: lens?.supplier?.name ?? undefined,
		snapshotBaseCost: item.costOverrides?.baseCost ?? lens?.pairPurchasePrice,
		snapshotMountingPrice: item.costOverrides?.mountingPrice ?? lens?.mountingPrice,
		snapshotShippingPrice: item.shippingCostPending
			? undefined
			: (item.costOverrides?.shippingPrice ?? lens?.shippingPrice),
		snapshotSalePrice: lens?.salePrice ?? undefined,
		snapshotPriceType: lens?.priceType,
		snapshotIsTaxable: lens?.isTaxable ?? false
	};
}

export function buildSaleItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): SaleItemInput[] {
	const saleItems: SaleItemInput[] = [];

	for (const item of items) {
		if (item.kind === 'free') {
			if (!item.freeItem) continue;
			saleItems.push({
				itemType: SaleItemType.FREE_ITEM,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				freeItemCategory: item.freeItem.category,
				freeItemDescription: item.freeItem.description,
				freeItemUnitCost: item.freeItem.unitCost ?? undefined,
				freeItemSupplierId: item.freeItem.supplierId ?? undefined,
				freeItemOpticalNotes: item.freeItem.opticalNotes || undefined,
				notes: item.notes || undefined
			});
			continue;
		}

		if (item.kind === 'product') {
			const product = products.find((candidate) => candidate.id === item.productId);
			saleItems.push({
				itemType: SaleItemType.PRODUCT,
				productId: item.productId,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				notes: item.notes || undefined,
				snapshotName: product?.name,
				snapshotSku: product?.sku ?? undefined,
				snapshotBrand: product?.brand?.name ?? undefined,
				snapshotIsTaxable: product?.isTaxable ?? true
			});
			continue;
		}

		if (item.kind === 'treatment') {
			const lensParent = items.find((i) => i.id === item.parentLensItemId);
			saleItems.push({
				itemType: SaleItemType.TREATMENT,
				parentSaleItemId: lensParent?.id ?? item.parentLensItemId,
				supplierTreatmentId: item.supplierTreatmentId,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				snapshotName: item.treatmentName,
				snapshotBrand: item.snapshotBrand,
				snapshotTreatmentCategory: item.treatmentCategory,
				snapshotIsTaxable: item.isTaxable,
				snapshotBaseCost: item.costOverride ?? item.purchasePrice,
				notes: item.notes || undefined
			});
			continue;
		}

		if (!item.lensPair) continue;

		const parentSaleItemId = item.id;
		const lensPairItem = buildLensPairItemBase(item, lensItems);
		if (!lensPairItem) continue;

		saleItems.push({
			id: parentSaleItemId,
			itemType: SaleItemType.LENS_PAIR,
			lensCatalogItemId: item.lensPair.catalogItemId,
			odSphere: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.sphere ?? undefined)
				: undefined,
			odCylinder: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.cylinder ?? undefined)
				: undefined,
			odAxis: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.axis ?? undefined)
				: undefined,
			odAddition: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.addition ?? undefined)
				: undefined,
			odAltura: item.lensPair.od.enabled ? (item.lensPair.od.altura ?? undefined) : undefined,
			osSphere: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.sphere ?? undefined)
				: undefined,
			osCylinder: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.cylinder ?? undefined)
				: undefined,
			osAxis: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.axis ?? undefined)
				: undefined,
			osAddition: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.addition ?? undefined)
				: undefined,
			osAltura: item.lensPair.oi.enabled ? (item.lensPair.oi.altura ?? undefined) : undefined,
			quantity: 1,
			unitPrice: item.unitPrice,
			discount: item.discount,
			discountType: item.discountType,
			notes: item.notes || undefined,
			snapshotName: lensPairItem.snapshotName,
			snapshotBrand: lensPairItem.snapshotBrand,
			snapshotBaseCost: lensPairItem.snapshotBaseCost,
			snapshotMountingPrice: lensPairItem.snapshotMountingPrice,
			snapshotShippingPrice: lensPairItem.snapshotShippingPrice,
			snapshotSalePrice: lensPairItem.snapshotSalePrice,
			snapshotPriceType: lensPairItem.snapshotPriceType,
			snapshotIsTaxable: lensPairItem.snapshotIsTaxable,
			shippingCostPending: item.shippingCostPending || undefined
		});
	}

	return saleItems;
}

export function buildQuoteItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): QuoteItemInput[] {
	const quoteItems: QuoteItemInput[] = [];

	for (const item of items) {
		if (item.kind === 'free') {
			if (!item.freeItem) continue;
			quoteItems.push({
				itemType: SaleItemType.FREE_ITEM,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				freeItemCategory: item.freeItem.category,
				freeItemDescription: item.freeItem.description,
				freeItemUnitCost: item.freeItem.unitCost ?? undefined,
				freeItemSupplierId: item.freeItem.supplierId ?? undefined,
				freeItemOpticalNotes: item.freeItem.opticalNotes || undefined,
				notes: item.notes || undefined
			});
			continue;
		}

		if (item.kind === 'product') {
			const product = products.find((candidate) => candidate.id === item.productId);
			quoteItems.push({
				itemType: SaleItemType.PRODUCT,
				productId: item.productId,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				notes: item.notes || undefined,
				snapshotName: product?.name,
				snapshotSku: product?.sku ?? undefined,
				snapshotBrand: product?.brand?.name ?? undefined,
				snapshotIsTaxable: product?.isTaxable ?? true
			});
			continue;
		}

		if (item.kind === 'treatment') {
			const lensParent = items.find((i) => i.id === item.parentLensItemId);
			quoteItems.push({
				itemType: SaleItemType.TREATMENT,
				parentQuoteItemId: lensParent?.id ?? item.parentLensItemId,
				supplierTreatmentId: item.supplierTreatmentId,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				snapshotName: item.treatmentName,
				snapshotBrand: item.snapshotBrand,
				snapshotTreatmentCategory: item.treatmentCategory,
				snapshotIsTaxable: item.isTaxable,
				snapshotBaseCost: item.costOverride ?? item.purchasePrice,
				notes: item.notes || undefined
			});
			continue;
		}

		if (!item.lensPair) continue;

		const parentQuoteItemId = item.id;
		const lensPairItem = buildLensPairItemBase(item, lensItems);
		if (!lensPairItem) continue;

		quoteItems.push({
			id: parentQuoteItemId,
			itemType: SaleItemType.LENS_PAIR,
			lensCatalogItemId: item.lensPair.catalogItemId,
			odSphere: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.sphere ?? undefined)
				: undefined,
			odCylinder: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.cylinder ?? undefined)
				: undefined,
			odAxis: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.axis ?? undefined)
				: undefined,
			odAddition: item.lensPair.od.enabled
				? (item.lensPair.od.prescription.addition ?? undefined)
				: undefined,
			odAltura: item.lensPair.od.enabled ? (item.lensPair.od.altura ?? undefined) : undefined,
			osSphere: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.sphere ?? undefined)
				: undefined,
			osCylinder: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.cylinder ?? undefined)
				: undefined,
			osAxis: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.axis ?? undefined)
				: undefined,
			osAddition: item.lensPair.oi.enabled
				? (item.lensPair.oi.prescription.addition ?? undefined)
				: undefined,
			osAltura: item.lensPair.oi.enabled ? (item.lensPair.oi.altura ?? undefined) : undefined,
			quantity: 1,
			unitPrice: item.unitPrice,
			discount: item.discount,
			discountType: item.discountType,
			notes: item.notes || undefined,
			snapshotName: lensPairItem.snapshotName,
			snapshotBrand: lensPairItem.snapshotBrand,
			snapshotBaseCost: lensPairItem.snapshotBaseCost,
			snapshotMountingPrice: lensPairItem.snapshotMountingPrice,
			snapshotShippingPrice: lensPairItem.snapshotShippingPrice,
			snapshotSalePrice: lensPairItem.snapshotSalePrice,
			snapshotPriceType: lensPairItem.snapshotPriceType,
			snapshotIsTaxable: lensPairItem.snapshotIsTaxable
		});
	}

	return quoteItems;
}

export function buildPrescriptionPayload(
	items: SaleItemRow[],
	prescriptionDate: string
): PrescriptionFieldsPayload | undefined {
	const lensItem = items.find((i): i is LensSaleItemRow => i.kind === 'lens');
	if (!lensItem) return undefined;

	const pair = lensItem.lensPair;
	const hasValues =
		pair.od.prescription.sphere != null ||
		pair.od.prescription.cylinder != null ||
		pair.oi.prescription.sphere != null ||
		pair.oi.prescription.cylinder != null;
	if (!hasValues) return undefined;

	return {
		prescriptionDate,
		odSphere: pair.od.prescription.sphere ?? undefined,
		odCylinder: pair.od.prescription.cylinder ?? undefined,
		odAxis: pair.od.prescription.axis ?? undefined,
		odAddition: pair.od.prescription.addition ?? undefined,
		odAltura: pair.od.altura ?? undefined,
		osSphere: pair.oi.prescription.sphere ?? undefined,
		osCylinder: pair.oi.prescription.cylinder ?? undefined,
		osAxis: pair.oi.prescription.axis ?? undefined,
		osAddition: pair.oi.prescription.addition ?? undefined,
		osAltura: pair.oi.altura ?? undefined,
		dp: pair.od.dp ?? undefined,
		npRight: pair.od.np ?? undefined,
		npLeft: pair.oi.np ?? undefined,
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: undefined,
		recommendedLensType: (pair.lensType as LensType) || LensType.MONOFOCAL,
		notes: undefined,
		doctorName: pair.doctorName || undefined,
		isCurrent: true
	} as PrescriptionFieldsPayload;
}
