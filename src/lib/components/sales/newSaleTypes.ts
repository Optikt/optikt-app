import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';

export type ItemKind = 'product' | 'lens';

export interface SaleItemRow {
	id: string;
	kind: ItemKind;
	productId: string;
	lensCatalogItemId: string;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: DiscountTypeEnum;
	notes: string;
}

export interface NewCustomerData {
	firstName: string;
	lastName: string;
	idNumber: string;
	primaryPhone: string;
	email: string;
	address: string;
	notes: string;
}
