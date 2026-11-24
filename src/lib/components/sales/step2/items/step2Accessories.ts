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

/** Builds auto-included accessory rows for a parent item, splitting out-of-stock warnings. */
export function buildIncludedAccessoriesForParent(
	parentItemId: string,
	parentQuantity: number,
	rules: readonly IncludedAccessoryRule[]
): {
	accessoryItems: SaleItemRow[];
	linkedIds: string[];
	addedNames: string[];
	outOfStockNames: string[];
} {
	const qty = Math.max(1, Math.floor(parentQuantity || 1));
	const accessoryItems: SaleItemRow[] = [];
	const linkedIds: string[] = [];
	const addedNames: string[] = [];
	const outOfStockNames: string[] = [];

	for (const rule of rules) {
		if (rule.accessory.stock <= 0) {
			outOfStockNames.push(rule.accessory.name);
			continue;
		}
		const accessoryItem = createIncludedAccessoryItem(parentItemId, rule);
		accessoryItem.quantity = Math.min(qty, rule.accessory.stock);
		accessoryItems.push(accessoryItem);
		linkedIds.push(accessoryItem.id);
		addedNames.push(rule.accessory.name);
	}

	return { accessoryItems, linkedIds, addedNames, outOfStockNames };
}
