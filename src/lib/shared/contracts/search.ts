import { LensType } from '$lib/shared/enums/lensTypes';
import { PatientEye } from './common';
import type { CoreLensTreatmentCode } from './lenses';

export enum SearchScope {
	GLOBAL = 'GLOBAL',
	DOCUMENT = 'DOCUMENT',
	CUSTOMER = 'CUSTOMER',
	PRODUCT = 'PRODUCT',
	LENS = 'LENS',
	PROVIDER_OR_BRAND = 'PROVIDER_OR_BRAND'
}

export interface OpticalEyeQuery {
	eye: PatientEye;
	sphere: number | null;
	cylinder: number | null;
	addition: number | null;
	axis: number | null;
}

export interface LensSearchFilters {
	lensType: LensType | null;
	supplierId: string | null;
	materialId: string | null;
	onlySurplusStock: boolean;
	onlyLowStock: boolean;
	photochromic: boolean | null;
	requiredTreatments: CoreLensTreatmentCode[];
	eyes: OpticalEyeQuery[];
}

export interface ScopedSearchQuery {
	raw: string;
	scope: SearchScope;
	text: string;
	documentNumber: number | null;
	customerTerm: string | null;
	productTerm: string | null;
	providerOrBrandTerm: string | null;
	lensFilters: LensSearchFilters | null;
}

export const SEARCH_SCOPE_PREFIXES: Record<SearchScope, string | null> = {
	[SearchScope.GLOBAL]: null,
	[SearchScope.DOCUMENT]: '#',
	[SearchScope.CUSTOMER]: '@',
	[SearchScope.PRODUCT]: '!',
	[SearchScope.LENS]: '*',
	[SearchScope.PROVIDER_OR_BRAND]: '%'
};

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
	[SearchScope.GLOBAL]: 'Global',
	[SearchScope.DOCUMENT]: 'Documentos',
	[SearchScope.CUSTOMER]: 'Pacientes',
	[SearchScope.PRODUCT]: 'Productos',
	[SearchScope.LENS]: 'Cristales',
	[SearchScope.PROVIDER_OR_BRAND]: 'Proveedores y marcas'
};