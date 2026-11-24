import type { SaleItemRow } from '../../newSaleTypes';
import { createEmptyProductItem } from '../../newSaleTypes';
import { cacheProductIfMissing } from '../../catalogCache.svelte';

export interface IncludedAccessoryRule {
	accessoryProductId: string;
	priceMode: string;
	customPrice: number | null;
	currentProductPrice: number | null;
	accessory: {
		id: string;
		name: string;
		sku?: string;
		stock: number;
		type?: string;
		currentSalePrice?: number | null;
	};
}

export function createIncludedAccessoryItem(
	parentItemId: string,
	accessoryRule: IncludedAccessoryRule
): SaleItemRow {
	cacheProductIfMissing(accessoryRule.accessory);
	const price = (() => {
		switch (accessoryRule.priceMode) {
			case 'PRODUCT':
				return accessoryRule.currentProductPrice ?? 0;
			case 'CUSTOM':
				return accessoryRule.customPrice ?? 0;
			default:
				return 0;
		}
	})();
	return {
		...createEmptyProductItem(accessoryRule.accessoryProductId),
		unitPrice: price,
		isIncludedAccessory: true,
		includedAccessoryParentItemId: parentItemId
	} as SaleItemRow;
}
