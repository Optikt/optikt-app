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

export function getLensMarginPercent(
	pairPurchasePrice: number,
	salePrice: number | null | undefined
): number | null {
	if (!salePrice || pairPurchasePrice <= 0) return null;
	return ((salePrice - pairPurchasePrice) / pairPurchasePrice) * 100;
}

export function getLensTaxSummary(isTaxable: boolean): string {
	return isTaxable ? 'IVA activo' : 'Exento';
}
