/**
 * Shared test fixtures for the sale helper module specs (helpers/*.spec.ts).
 * Not a spec file — only factories used to build rows/lenses.
 */

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import { DiscountType } from '$lib/shared/enums';
import {
	LensCatalogSource,
	LensInventoryMode,
	LensPriceType,
	LensType
} from '$lib/shared/enums/lensTypes';

import {
	createEmptyLensPair,
	type LensSaleItemRow,
	type ProductSaleItemRow,
	type SaleItemRow,
	type SelectedTreatment,
	type TreatmentSaleItemRow
} from '../newSaleTypes';
import {
	buildStep2PrescriptionConfirmation,
	type Step2PrescriptionConfirmation
} from './lensConfirmation';

export function makeLensItem(
	overrides: Partial<LensCatalogItemWithRelations> = {}
): LensCatalogItemWithRelations {
	return {
		id: 'lens-1',
		source: LensCatalogSource.LAB,
		supplierId: 'supplier-1',
		name: 'Alpha Lens',
		type: LensType.MONOFOCAL,
		technologyId: null,
		differentiators: [],
		arColors: null,
		photochromicColors: null,
		materialId: 'material-1',
		hasAr: false,
		hasBluecut: false,
		isPhotochromic: false,
		priceType: LensPriceType.PAIR,
		basePrice: 10,
		pairPurchasePrice: 20,
		salePrice: 30,
		mountingPrice: 2,
		shippingPrice: 1,
		isTaxable: false,
		inventoryMode: LensInventoryMode.ON_DEMAND,
		stock: null,
		notes: null,
		deletedAt: null,
		createdAt: '2026-04-20T00:00:00.000Z',
		updatedAt: '2026-04-20T00:00:00.000Z',
		material: null,
		supplier: null,
		technologyName: null,
		ranges: [],
		...overrides
	};
}

export function makeConfirmationLensRow(id: string = 'row-1'): LensSaleItemRow {
	const lensPair = createEmptyLensPair();
	lensPair.catalogItemId = 'lens-1';

	return {
		id,
		kind: 'lens',
		productId: '',
		quantity: 1,
		lensPair,
		treatments: [],
		costOverrides: { baseCost: 0, mountingPrice: 0, shippingPrice: 0 },
		shippingCostPending: false,
		unitPrice: 30,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null
	};
}

export type RxOverrides = Partial<{
	odSphere: number | null;
	odCylinder: number | null;
	odAxis: number | null;
	odAddition: number | null;
	oiSphere: number | null;
	oiCylinder: number | null;
	oiAxis: number | null;
	oiAddition: number | null;
	lensType: string;
}>;

export function makeConfirmation(
	overrides: RxOverrides = {},
	items: SaleItemRow[] = [makeConfirmationLensRow()],
	lensItems: LensCatalogItemWithRelations[] = [makeLensItem()]
): Step2PrescriptionConfirmation {
	const row = items.find((i) => i.kind === 'lens');
	if (row?.lensPair) {
		const pair = row.lensPair;
		const toNum = (v: string | number | null | undefined): number | null => {
			if (v == null) return null;
			if (typeof v === 'number') return v;
			const n = Number(v);
			return isNaN(n) ? null : n;
		};
		pair.od.prescription = {
			sphere: toNum(overrides.odSphere) ?? 1.0,
			cylinder: toNum(overrides.odCylinder) ?? -0.5,
			axis: toNum(overrides.odAxis) ?? 90,
			addition: toNum(overrides.odAddition) ?? null
		};
		pair.oi.prescription = {
			sphere: toNum(overrides.oiSphere) ?? 1.25,
			cylinder: toNum(overrides.oiCylinder) ?? -0.25,
			axis: toNum(overrides.oiAxis) ?? 85,
			addition: toNum(overrides.oiAddition) ?? null
		};
		pair.lensType = overrides.lensType ?? LensType.MONOFOCAL;
	}
	return buildStep2PrescriptionConfirmation(items, lensItems);
}

export function makeProductRow(overrides: Partial<ProductSaleItemRow> = {}): ProductSaleItemRow {
	return {
		id: 'item-1',
		kind: 'product',
		productId: 'prod-1',
		quantity: 1,
		unitPrice: 100,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		...overrides
	};
}

export function makeLensRow(treatments: SelectedTreatment[] = []): LensSaleItemRow {
	const pair = createEmptyLensPair();
	pair.catalogItemId = 'lens-1';
	return {
		id: 'item-2',
		kind: 'lens',
		productId: '',
		quantity: 1,
		lensPair: pair,
		treatments,
		costOverrides: { baseCost: 0, mountingPrice: 0, shippingPrice: 0 },
		shippingCostPending: false,
		unitPrice: 50,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null
	};
}

export function makeTreatment(price: number, name = 'AR Angel'): SelectedTreatment {
	return {
		supplierTreatmentId: crypto.randomUUID(),
		name,
		category: 'AR',
		price,
		isTaxable: true
	};
}

export function makeTreatmentRow(
	parentLensItemId: string,
	price: number,
	eyeCount: number
): TreatmentSaleItemRow {
	return {
		id: crypto.randomUUID(),
		kind: 'treatment',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		parentLensItemId,
		supplierTreatmentId: crypto.randomUUID(),
		treatmentName: 'AR Angel',
		treatmentCategory: 'AR',
		isTaxable: true,
		snapshotBrand: 'Test',
		purchasePrice: price * 0.5,
		quantity: eyeCount,
		unitPrice: price,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: ''
	};
}

export function makeStockProduct(id: string, stock: number | null): ProductWithRelations {
	return {
		id,
		name: id,
		stock,
		currentSalePrice: 0,
		type: 'FRAME'
	} as ProductWithRelations;
}
