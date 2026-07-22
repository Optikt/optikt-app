import { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import { LensType } from '$lib/shared/enums';
import type { LensOrderedPrescription } from '$lib/shared/contracts/lenses';

export type ItemKind = 'product' | 'lens' | 'free' | 'treatment';

/** A treatment selected for a lens item in the wizard */
export interface SelectedTreatment {
	supplierTreatmentId: string;
	name: string;
	category: string;
	price: number;
	isTaxable: boolean;
}

/** Prescription data for a single eye in the wizard (string values for form inputs) */
export interface LensEyeEntry {
	enabled: boolean;
	prescription: LensOrderedPrescription;
	dp: number | null;
	np: number | null;
}

/** A lens pair entry - both eyes sharing the same catalog item */
export interface LensPairEntry {
	catalogItemId: string;
	od: LensEyeEntry;
	oi: LensEyeEntry;
	lensType: string;
	doctorName: string;
}

/** Internal cost overrides - allows the user to edit cost values in the wizard */
export interface CostOverrides {
	baseCost: number;
	mountingPrice: number;
	shippingPrice: number;
}

/** Free item data for FREE_ITEM type items */
export interface FreeItemData {
	category: string;
	description: string;
	unitCost: number | null;
	supplierId: string | null;
	opticalNotes: string;
}

// ─── DISCRIMINATED UNION: SaleItemRow ───

interface BaseSaleItemRow {
	id: string;
	isIncludedAccessory: boolean;
	includedAccessoryParentItemId: string | null;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: DiscountTypeEnum;
	notes: string;
}

export interface ProductSaleItemRow extends BaseSaleItemRow {
	kind: 'product';
	productId: string;
}

export interface LensSaleItemRow extends BaseSaleItemRow {
	kind: 'lens';
	productId: string;
	lensPair: LensPairEntry;
	treatments: SelectedTreatment[];
	costOverrides: CostOverrides;
	shippingCostPending: boolean;
}

export interface FreeSaleItemRow extends BaseSaleItemRow {
	kind: 'free';
	productId: string;
	freeItem: FreeItemData;
}

export interface TreatmentSaleItemRow extends BaseSaleItemRow {
	kind: 'treatment';
	parentLensItemId: string;
	supplierTreatmentId: string;
	treatmentName: string;
	treatmentCategory: string;
	isTaxable: boolean;
	snapshotBrand: string;
	purchasePrice: number;
	costOverride?: number;
}

export type SaleItemRow =
	ProductSaleItemRow | LensSaleItemRow | FreeSaleItemRow | TreatmentSaleItemRow;

export function createEmptyProductItem(productId = ''): ProductSaleItemRow {
	return {
		id: crypto.randomUUID(),
		kind: 'product',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		productId,
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountTypeEnum.FIXED,
		notes: ''
	};
}

export function createEmptyLensItem(): LensSaleItemRow {
	return {
		id: crypto.randomUUID(),
		kind: 'lens',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		productId: '',
		quantity: 1,
		lensPair: createEmptyLensPair(),
		treatments: [],
		costOverrides: { baseCost: 0, mountingPrice: 0, shippingPrice: 0 },
		shippingCostPending: false,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountTypeEnum.FIXED,
		notes: ''
	};
}

export function createEmptyTreatmentItem(
	parentLensItemId: string,
	treatment: {
		id: string;
		name: string;
		category: string;
		price: number;
		salePrice?: number | null;
		isTaxable: boolean;
	},
	brand: string,
	eyeCount: number = 1,
	costOverride?: number
): TreatmentSaleItemRow {
	return {
		id: crypto.randomUUID(),
		kind: 'treatment',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		quantity: eyeCount,
		unitPrice: treatment.salePrice ?? treatment.price,
		discount: 0,
		discountType: DiscountTypeEnum.FIXED,
		notes: '',
		parentLensItemId,
		supplierTreatmentId: treatment.id,
		treatmentName: treatment.name,
		treatmentCategory: treatment.category,
		isTaxable: treatment.isTaxable,
		snapshotBrand: brand,
		purchasePrice: treatment.price,
		costOverride
	};
}

export function createEmptyFreeItem(): FreeSaleItemRow {
	return {
		id: crypto.randomUUID(),
		kind: 'free',
		isIncludedAccessory: false,
		includedAccessoryParentItemId: null,
		productId: '',
		quantity: 1,
		freeItem: createEmptyFreeItemData(),
		unitPrice: 0,
		discount: 0,
		discountType: DiscountTypeEnum.FIXED,
		notes: ''
	};
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

/** Create an empty eye entry with null prescription values */
export function createEmptyEyeEntry(): LensEyeEntry {
	return {
		enabled: true,
		prescription: { sphere: null, cylinder: null, axis: null, addition: null },
		dp: null,
		np: null
	};
}

/** Create an empty lens pair entry */
export function createEmptyLensPair(): LensPairEntry {
	return {
		catalogItemId: '',
		od: createEmptyEyeEntry(),
		oi: createEmptyEyeEntry(),
		lensType: LensType.MONOFOCAL,
		doctorName: ''
	};
}

/** Create an empty free item data entry */
export function createEmptyFreeItemData(): FreeItemData {
	return {
		category: 'CONTACT_LENS_FORMULA',
		description: '',
		unitCost: null,
		supplierId: null,
		opticalNotes: ''
	};
}
