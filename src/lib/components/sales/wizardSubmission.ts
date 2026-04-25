import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { QuoteItemInput } from '$lib/schemas/quotes';
import { PrescriptionFieldsSchema } from '$lib/schemas/prescriptions';
import type { SaleItemInput } from '$lib/schemas/sales';
import { DiscountType } from '$lib/shared/enums';
import { LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import type { z } from 'zod';

import type { SaleItemRow } from './newSaleTypes';
import { getEnabledEyeCount } from './saleItemHelpers';

interface WizardPrescriptionValues {
	odSphere: string | number;
	odCylinder: string | number;
	odAxis: string | number;
	odAddition: string | number;
	oiSphere: string | number;
	oiCylinder: string | number;
	oiAxis: string | number;
	oiAddition: string | number;
	lensType: string;
	doctorName: string;
}

type PrescriptionFieldsPayload = z.input<typeof PrescriptionFieldsSchema>;

function hasPrescriptionValues(values: WizardPrescriptionValues): boolean {
	return [
		values.odSphere,
		values.odCylinder,
		values.odAxis,
		values.odAddition,
		values.oiSphere,
		values.oiCylinder,
		values.oiAxis,
		values.oiAddition
	].some((value) => value != null && String(value).trim() !== '');
}

function buildLensPairItemBase(
	item: SaleItemRow,
	lensItems: LensCatalogItemWithRelations[],
	defaultTaxRate: number
) {
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
		snapshotIsTaxable: lens?.isTaxable ?? false,
		snapshotTaxRate: defaultTaxRate
	};
}

export function buildSaleItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[],
	defaultTaxRate: number = DEFAULT_TAX_RATE
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
				snapshotIsTaxable: product?.isTaxable ?? true,
				snapshotTaxRate: defaultTaxRate
			});
			continue;
		}

		if (!item.lensPair) continue;

		const parentSaleItemId = crypto.randomUUID();
		const lensPairItem = buildLensPairItemBase(item, lensItems, defaultTaxRate);
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
			snapshotTaxRate: lensPairItem.snapshotTaxRate,
			shippingCostPending: item.shippingCostPending || undefined
		});

		for (const treatment of item.treatments) {
			saleItems.push({
				itemType: SaleItemType.TREATMENT,
				parentSaleItemId,
				supplierTreatmentId: treatment.supplierTreatmentId,
				quantity: lensPairItem.eyeCount,
				unitPrice: treatment.price,
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotName: treatment.name,
				snapshotBrand: lensPairItem.snapshotBrand,
				snapshotTreatmentCategory: treatment.category,
				snapshotIsTaxable: treatment.isTaxable,
				snapshotTaxRate: defaultTaxRate
			});
		}
	}

	return saleItems;
}

export function buildQuoteItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[],
	defaultTaxRate: number = DEFAULT_TAX_RATE
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
				snapshotIsTaxable: product?.isTaxable ?? true,
				snapshotTaxRate: defaultTaxRate
			});
			continue;
		}

		if (!item.lensPair) continue;

		const parentQuoteItemId = crypto.randomUUID();
		const lensPairItem = buildLensPairItemBase(item, lensItems, defaultTaxRate);
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
			snapshotTaxRate: lensPairItem.snapshotTaxRate
		});

		for (const treatment of item.treatments) {
			quoteItems.push({
				itemType: SaleItemType.TREATMENT,
				parentQuoteItemId,
				supplierTreatmentId: treatment.supplierTreatmentId,
				quantity: lensPairItem.eyeCount,
				unitPrice: treatment.price,
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotName: treatment.name,
				snapshotBrand: lensPairItem.snapshotBrand,
				snapshotTreatmentCategory: treatment.category,
				snapshotIsTaxable: treatment.isTaxable,
				snapshotTaxRate: defaultTaxRate
			});
		}
	}

	return quoteItems;
}

export function buildPrescriptionPayload(
	values: WizardPrescriptionValues,
	prescriptionDate: string
): PrescriptionFieldsPayload | undefined {
	if (!hasPrescriptionValues(values)) return undefined;

	return {
		prescriptionDate,
		odSphere: values.odSphere,
		odCylinder: values.odCylinder,
		odAxis: values.odAxis || undefined,
		odAddition: values.odAddition,
		osSphere: values.oiSphere,
		osCylinder: values.oiCylinder,
		osAxis: values.oiAxis || undefined,
		osAddition: values.oiAddition,
		dp: undefined,
		npRight: undefined,
		npLeft: undefined,
		altura: undefined,
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: undefined,
		recommendedLensType: (values.lensType as LensType) || LensType.MONOFOCAL,
		notes: undefined,
		doctorName: values.doctorName,
		isCurrent: true
	};
}
