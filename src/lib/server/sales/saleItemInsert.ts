import type { saleItemFreeDetails } from '$lib/server/db/schema';

type FreeDetailsInsert = typeof saleItemFreeDetails.$inferInsert;

type Nullable<T> = T | null | undefined;

/** Structural source: accepts SaleItemInput and quote item details (null-tolerant fields). */
type SaleItemInsertSource = {
	itemType: string;
	productId?: Nullable<string>;
	lensCatalogItemId?: Nullable<string>;
	supplierTreatmentId?: Nullable<string>;
	odSphere?: Nullable<number>;
	odCylinder?: Nullable<number>;
	odAxis?: Nullable<number>;
	odAddition?: Nullable<number>;
	odAltura?: Nullable<number>;
	osSphere?: Nullable<number>;
	osCylinder?: Nullable<number>;
	osAxis?: Nullable<number>;
	osAddition?: Nullable<number>;
	osAltura?: Nullable<number>;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: string;
	snapshotName?: Nullable<string>;
	snapshotSku?: Nullable<string>;
	snapshotBrand?: Nullable<string>;
	snapshotBaseCost?: Nullable<number>;
	snapshotMountingPrice?: Nullable<number>;
	snapshotShippingPrice?: Nullable<number>;
	snapshotSalePrice?: Nullable<number>;
	snapshotPriceType?: Nullable<string>;
	snapshotTreatmentCategory?: Nullable<string>;
	snapshotIsTaxable?: Nullable<boolean>;
	shippingCostPending?: Nullable<boolean>;
	notes?: Nullable<string>;
};

export interface SaleItemInsertParams {
	id: string;
	saleId: string;
	item: SaleItemInsertSource;
	parentSaleItemId: string | null;
	prescriptionId: string | null;
	lotId: string | null;
	snapshotCostTotal: number | null;
	snapshotCostUnit: number | null;
	snapshotLotsCount: number | null;
	now: string;
}

export function saleItemInsertValues(params: SaleItemInsertParams) {
	const {
		id,
		saleId,
		item,
		parentSaleItemId,
		prescriptionId,
		lotId,
		snapshotCostTotal,
		snapshotCostUnit,
		snapshotLotsCount,
		now
	} = params;

	return {
		id,
		saleId,
		itemType: item.itemType,
		parentSaleItemId,
		productId: item.productId ?? null,
		lensCatalogItemId: item.lensCatalogItemId ?? null,
		supplierTreatmentId: item.supplierTreatmentId ?? null,
		prescriptionId,
		lotId,
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
		snapshotCostTotal,
		snapshotCostUnit,
		snapshotLotsCount,
		snapshotBaseCost: item.snapshotBaseCost ?? null,
		snapshotMountingPrice: item.snapshotMountingPrice ?? null,
		snapshotShippingPrice: item.snapshotShippingPrice ?? null,
		snapshotSalePrice: item.snapshotSalePrice ?? null,
		snapshotPriceType: item.snapshotPriceType ?? null,
		snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? null,
		snapshotIsTaxable: item.snapshotIsTaxable ?? null,
		shippingCostPending: item.shippingCostPending ?? false,
		notes: item.notes ?? null,
		createdAt: now,
		updatedAt: now
	};
}

export interface SaleItemFreeDetailsInsertParams {
	id: string;
	saleItemId: string;
	category: FreeDetailsInsert['category'];
	description: string;
	enrichmentStatus: FreeDetailsInsert['enrichmentStatus'];
	unitCost?: number | null;
	supplierId?: string | null;
	opticalNotes?: string | null;
	enrichedAt?: string | null;
	enrichedById?: string | null;
	now: string;
}

export function saleItemFreeDetailsInsertValues(params: SaleItemFreeDetailsInsertParams) {
	return {
		id: params.id,
		saleItemId: params.saleItemId,
		category: params.category,
		description: params.description,
		enrichmentStatus: params.enrichmentStatus,
		unitCost: params.unitCost ?? null,
		supplierId: params.supplierId ?? null,
		opticalNotes: params.opticalNotes ?? null,
		enrichedAt: params.enrichedAt ?? null,
		enrichedById: params.enrichedById ?? null,
		createdAt: params.now,
		updatedAt: params.now
	};
}
