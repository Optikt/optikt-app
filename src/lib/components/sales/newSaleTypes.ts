import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
import type { CoreLensTreatmentCode, LensOrderedPrescription } from '$lib/shared/contracts/lenses';
import type { CompatibilityVerdict } from '$lib/shared/matching/types';

export type ItemKind = 'product' | 'lens';

/** Prescription data for a single eye in the wizard (string values for form inputs) */
export interface LensEyeEntry {
	enabled: boolean;
	prescription: LensOrderedPrescription;
	compatibilityVerdict: CompatibilityVerdict | null;
}

/** A lens pair entry — both eyes sharing the same catalog item + treatments */
export interface LensPairEntry {
	catalogItemId: string;
	od: LensEyeEntry;
	oi: LensEyeEntry;
	selectedOptionalTreatments: CoreLensTreatmentCode[];
}

export interface SaleItemRow {
	id: string;
	kind: ItemKind;
	// Product fields
	productId: string;
	quantity: number;
	// Lens fields (only when kind === 'lens')
	lensPair: LensPairEntry | null;
	// Shared
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

/** Create an empty eye entry with null prescription values */
export function createEmptyEyeEntry(): LensEyeEntry {
	return {
		enabled: true,
		prescription: { sphere: null, cylinder: null, axis: null, addition: null },
		compatibilityVerdict: null
	};
}

/** Create an empty lens pair entry */
export function createEmptyLensPair(): LensPairEntry {
	return {
		catalogItemId: '',
		od: createEmptyEyeEntry(),
		oi: createEmptyEyeEntry(),
		selectedOptionalTreatments: []
	};
}
