import { ProductType } from '$lib/shared/enums/productTypes';

import type { SaleItemRow } from './newSaleTypes';

export type IncludedAccessoryMap = Record<string, string[]>;

export function canAutoIncludeAccessories(productType: string | null | undefined): boolean {
	return productType === ProductType.FRAME || productType === ProductType.SUNGLASSES;
}

export function allowsDuplicateProductLines(productType: string | null | undefined): boolean {
	return productType === ProductType.ACCESSORY;
}

export function linkIncludedAccessories(
	currentMap: IncludedAccessoryMap,
	parentItemId: string,
	accessoryItemIds: string[]
): IncludedAccessoryMap {
	if (accessoryItemIds.length === 0) return currentMap;

	return {
		...currentMap,
		[parentItemId]: [...(currentMap[parentItemId] ?? []), ...accessoryItemIds]
	};
}

export function pruneIncludedAccessoryMap(
	currentMap: IncludedAccessoryMap,
	validItemIds: Iterable<string>
): IncludedAccessoryMap {
	const validIds = new Set(validItemIds);
	const nextMap: IncludedAccessoryMap = {};

	for (const [parentId, accessoryIds] of Object.entries(currentMap)) {
		if (!validIds.has(parentId)) continue;

		const nextAccessoryIds = accessoryIds.filter((accessoryId) => validIds.has(accessoryId));
		if (nextAccessoryIds.length > 0) {
			nextMap[parentId] = nextAccessoryIds;
		}
	}

	return nextMap;
}

export function removeItemWithIncludedAccessories(
	currentItems: SaleItemRow[],
	currentMap: IncludedAccessoryMap,
	removedItemId: string
): { items: SaleItemRow[]; includedAccessoryMap: IncludedAccessoryMap } {
	const linkedAccessoryIds = currentMap[removedItemId] ?? [];
	const removedIds = new Set([removedItemId, ...linkedAccessoryIds]);
	const nextItems = currentItems.filter((item) => !removedIds.has(item.id));

	const nextMap: IncludedAccessoryMap = {};
	for (const [parentId, accessoryIds] of Object.entries(currentMap)) {
		if (removedIds.has(parentId)) continue;

		const nextAccessoryIds = accessoryIds.filter((accessoryId) => !removedIds.has(accessoryId));
		if (nextAccessoryIds.length > 0) {
			nextMap[parentId] = nextAccessoryIds;
		}
	}

	return {
		items: nextItems,
		includedAccessoryMap: pruneIncludedAccessoryMap(
			nextMap,
			nextItems.map((item) => item.id)
		)
	};
}

/**
 * Mirrors a parent item's quantity onto its linked auto-included accessories.
 * Clamps each accessory to its available stock when `stockOf` returns a ceiling.
 * Returns `{ items, cappedIds }` so the caller can warn if an accessory hit stock.
 */
export function syncIncludedAccessoryQuantities(
	currentItems: SaleItemRow[],
	currentMap: IncludedAccessoryMap,
	parentItemId: string,
	parentQuantity: number,
	stockOf?: (productId: string, accessoryItemId: string) => number | null | undefined
): { items: SaleItemRow[]; cappedIds: string[] } {
	if (!Number.isFinite(parentQuantity) || parentQuantity < 1) {
		return { items: currentItems, cappedIds: [] };
	}
	const linkedIds = currentMap[parentItemId];
	if (!linkedIds || linkedIds.length === 0) {
		return { items: currentItems, cappedIds: [] };
	}

	const targetQty = Math.floor(parentQuantity);
	const linkedSet = new Set(linkedIds);
	const cappedIds: string[] = [];
	let changed = false;

	const nextItems = currentItems.map((item) => {
		if (!linkedSet.has(item.id) || item.kind !== 'product') return item;
		const stock = item.productId ? stockOf?.(item.productId, item.id) : null;
		let nextQty = targetQty;
		if (stock != null && targetQty > Math.max(stock, 0)) {
			nextQty = stock > 0 ? stock : Math.min(targetQty, item.quantity);
		}
		if (nextQty < targetQty) cappedIds.push(item.id);
		if (item.quantity === nextQty) return item;
		changed = true;
		return { ...item, quantity: nextQty };
	});

	return { items: changed ? nextItems : currentItems, cappedIds };
}
