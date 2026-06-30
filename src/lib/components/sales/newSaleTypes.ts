import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import { LensType } from '$lib/shared/enums';
import type { LensOrderedPrescription } from '$lib/shared/contracts/lenses';

export type ItemKind = 'product' | 'lens' | 'free';

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

export interface SaleItemRow {
	id: string;
	kind: ItemKind;
	isIncludedAccessory: boolean;
	includedAccessoryParentItemId: string | null;
	// Product fields
	productId: string;
	quantity: number;
	// Lens fields (only when kind === 'lens')
	lensPair: LensPairEntry | null;
	// Treatments (only when kind === 'lens')
	treatments: SelectedTreatment[];
	// Free item data (only when kind === 'free')
	freeItem: FreeItemData | null;
	// Shared
	unitPrice: number;
	discount: number;
	discountType: DiscountTypeEnum;
	notes: string;
	// Internal cost overrides (only when kind === 'lens')
	costOverrides: CostOverrides | null;
	/** When true, shipping cost is unknown at sale time and will be filled later */
	shippingCostPending: boolean;
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
		prescription: { sphere: null, cylinder: null, axis: null, addition: null }
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
