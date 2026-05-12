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
