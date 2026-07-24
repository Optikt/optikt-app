import type { BadgeVariant } from '$lib/shared/badge-variants';
import { LensCatalogSource, LensInventoryMode } from '$lib/shared/enums';

export function getLensSourceVariant(source: string): BadgeVariant {
	return source === LensCatalogSource.FINISHED ? 'info' : 'warning';
}

export function getLensInventoryVariant(
	inventoryMode: string,
	stock: number | null | undefined
): BadgeVariant {
	if (inventoryMode === LensInventoryMode.ON_DEMAND) return 'warning';
	if (stock == null) return 'neutral';
	if (stock <= 0) return 'error';
	return 'success';
}

export function getLensInventorySummary(
	inventoryMode: string,
	stock: number | null | undefined
): string {
	if (inventoryMode === LensInventoryMode.ON_DEMAND) return 'Por demanda';
	if (stock == null) return 'Sin dato';
	if (stock <= 0) return 'Agotado';
	return `${stock} en stock`;
}

export function getLensTotalCost(
	pairPurchasePrice: number,
	mountingPrice: number,
	shippingPrice: number
): number {
	return pairPurchasePrice + mountingPrice + shippingPrice;
}

export function getLensMarginPercent(
	totalCost: number,
	salePrice: number | null | undefined
): number | null {
	if (!salePrice || totalCost <= 0) return null;
	return ((salePrice - totalCost) / salePrice) * 100;
}

export function getLensTaxSummary(isTaxable: boolean): string {
	return isTaxable ? 'IVA activo' : 'Exento';
}
