import type {
	LensCatalogSource,
	LensInventoryMode,
	LensPriceType,
	LensType
} from '$lib/shared/enums';

export interface CatalogListEntry {
	id: string;
	name: string;
}

export interface LensCatalogFormData {
	source: LensCatalogSource;
	supplierId: string;
	name: string;
	type: LensType;
	technologyId: string;
	differentiators: string[];
	arColors: string[];
	photochromicColors: string[];
	materialId: string;
	hasAr: boolean;
	hasBluecut: boolean;
	isPhotochromic: boolean;
	priceType: LensPriceType;
	basePrice: string;
	salePrice: string;
	mountingPrice: string;
	shippingPrice: string;
	isTaxable: boolean;
	inventoryMode: LensInventoryMode;
	stock: string;
	notes: string;
}

export interface CatalogLists {
	suppliers: CatalogListEntry[];
	materials: CatalogListEntry[];
	supplierTechnologies: CatalogListEntry[];
}
