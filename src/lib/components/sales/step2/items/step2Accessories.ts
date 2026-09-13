import type { SaleItemRow } from '../../newSaleTypes';
import { createEmptyProductItem } from '../../newSaleTypes';

export interface IncludedAccessoryRule {
	accessoryProductId: string;
	priceMode: string;
	customPrice: number | null;
	currentProductPrice: number | null;
	accessory: { id: string; name: string; stock: number };
}

export function createIncludedAccessoryItem(
	parentItemId: string,
	accessoryRule: IncludedAccessoryRule
): SaleItemRow {
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
