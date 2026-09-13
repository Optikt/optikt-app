import type { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';

export interface AccessoryProductSummary {
	id: string;
	name: string;
	sku: string;
	stock: number;
	type: string;
	currentSalePrice: number | null;
}

export interface BrandAccessoryRuleRow {
	id: number;
	brandId: string;
	productId: string | null;
	accessoryProductId: string;
	priceMode: BrandAccessoryPriceMode;
	customPrice: number | null;
	currentProductPrice: number | null;
	isActive: boolean;
	accessory: AccessoryProductSummary;
}

export interface ProductAccessoryOverride {
	productId: string;
	brandId: string;
	isActive: boolean;
	accessories: BrandAccessoryRuleRow[];
}

export interface ResolvedAccessoryRule {
	ruleId: number;
	accessoryProductId: string;
	priceMode: BrandAccessoryPriceMode;
	customPrice: number | null;
	currentProductPrice: number | null;
	accessory: AccessoryProductSummary;
}

export interface UpsertBrandAccessoryData {
	id?: number;
	brandId: string;
	productId?: string | null;
	accessoryProductId: string;
	priceMode: BrandAccessoryPriceMode;
	customPrice?: number | null;
	isActive?: boolean;
	createdById: string;
}
