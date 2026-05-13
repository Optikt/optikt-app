export enum BrandAccessoryPriceMode {
	COURTESY = 'COURTESY',
	PRODUCT = 'PRODUCT',
	CUSTOM = 'CUSTOM'
}

export const ALL_BRAND_ACCESSORY_PRICE_MODES = Object.values(
	BrandAccessoryPriceMode
) as BrandAccessoryPriceMode[];

export const BRAND_ACCESSORY_PRICE_MODE_LABELS: Record<BrandAccessoryPriceMode, string> = {
	[BrandAccessoryPriceMode.COURTESY]: 'Cortesía',
	[BrandAccessoryPriceMode.PRODUCT]: 'Precio producto',
	[BrandAccessoryPriceMode.CUSTOM]: 'Precio personalizado'
};

export function getBrandAccessoryPriceModeLabel(priceMode: string): string {
	return BRAND_ACCESSORY_PRICE_MODE_LABELS[priceMode as BrandAccessoryPriceMode] ?? priceMode;
}
