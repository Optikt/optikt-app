import { LensCatalogSource, LensType } from '$lib/shared/enums/lensTypes';

/**
 * The exact prescription values a physical lens was ordered/ground with.
 * All fields nullable because not every lens type uses every parameter.
 */
export interface LensOrderedPrescription {
	sphere: number | null;
	cylinder: number | null;
	axis: number | null;
	addition: number | null;
}

export interface LensCatalogContract {
	id: string;
	supplierId: string;
	name: string;
	source: LensCatalogSource;
	lensType: LensType;
	materialId: string | null;
	hasAr: boolean;
	hasBluecut: boolean;
	isPhotochromic: boolean;
	basePrice: number;
	mountingPrice: number;
	shippingPrice: number;
}
