type Nullable<T> = T | null | undefined;

/** Structural source shared by sale items and quote items (null-tolerant fields). */
export interface SaleItemValueSource {
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
}

/** Item columns shared by sale_items and quote_items inserts. */
export function saleItemCommonValues(item: SaleItemValueSource) {
	return {
		itemType: item.itemType,
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
		notes: item.notes ?? null
	};
}
