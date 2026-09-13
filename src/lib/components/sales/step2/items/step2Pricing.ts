import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { SaleItemRow } from '../../newSaleTypes';
import { getEnabledEyeCount } from '../../saleItemHelpers';

/** Sale price for the lens - salePrice is always per pair. Falls back to cost (base + mounting + shipping). */
export function lensSalePrice(lens: LensCatalogItemWithRelations, _eyeCount: number): number {
	if (lens.salePrice != null && lens.salePrice > 0) {
		return lens.salePrice;
	}
	// Fallback to cost-based price
	return lens.pairPurchasePrice + lens.mountingPrice + lens.shippingPrice;
}

/** Recalculate unitPrice to the suggested sale price for the lens only (excluding treatments).
 *  Uses salePrice (sell price) when available, otherwise falls back to basePrice (cost). */
export function recalcSuggestedPrice(
	item: SaleItemRow,
	findLens: (id: string) => LensCatalogItemWithRelations | undefined
) {
	if (item.kind !== 'lens') return;
	const lens = findLens(item.lensPair.catalogItemId);
	if (!lens) return;

	const eyeCount = getEnabledEyeCount(item);
	if (eyeCount === 0) return;

	item.unitPrice = lensSalePrice(lens, eyeCount);
}
