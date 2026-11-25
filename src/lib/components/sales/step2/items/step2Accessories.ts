import { toast } from 'svelte-sonner';
import { getErrorMessage } from '$lib/utils/errors';
import { getAccessoriesForProduct } from '$lib/remote/brandAccessories.remote';
import type { ResolvedAccessoryRule } from '$lib/server/db/queries/brandAccessories/types';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { SaleItemRow } from '../../newSaleTypes';
import { createEmptyProductItem } from '../../newSaleTypes';
import {
	canAutoIncludeAccessories,
	linkIncludedAccessories,
	syncIncludedAccessoryQuantities,
	type IncludedAccessoryMap
} from '../../includedAccessories';
import { getAvailableProductStock, getRequestedProductQuantity } from '../../helpers/items';
import { cacheProduct } from '../../catalogCache.svelte';

export type IncludedAccessoryRule = Pick<
	ResolvedAccessoryRule,
	'accessoryProductId' | 'priceMode' | 'customPrice' | 'currentProductPrice' | 'accessory'
>;

export function createIncludedAccessoryItem(
	parentItemId: string,
	accessoryRule: IncludedAccessoryRule
): SaleItemRow {
	// Seed the on-demand catalog cache so UI, stock checks, IVA, and DB snapshots
	// resolve this accessory product without requiring a manual search first.
	cacheProduct(accessoryRule.accessory);
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
	rules: readonly IncludedAccessoryRule[],
	existingItems: readonly SaleItemRow[] = []
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
		const used = getRequestedProductQuantity(
			[...existingItems, ...accessoryItems],
			rule.accessoryProductId
		);
		const remainingStock = Math.max(0, rule.accessory.stock - used);
		if (remainingStock <= 0) {
			outOfStockNames.push(rule.accessory.name);
			continue;
		}
		const accessoryItem = createIncludedAccessoryItem(parentItemId, rule);
		accessoryItem.quantity = Math.min(qty, remainingStock);
		accessoryItems.push(accessoryItem);
		linkedIds.push(accessoryItem.id);
		addedNames.push(rule.accessory.name);
	}

	return { accessoryItems, linkedIds, addedNames, outOfStockNames };
}

/** Fetches and appends auto-included accessories for a newly added frame/sunglasses row. */
export async function fetchAndLinkIncludedAccessories(
	option: { kind: string; brandId?: string | null; productType?: string; id: string },
	parentItemId: string,
	state: {
		getItems: () => SaleItemRow[];
		getMap: () => IncludedAccessoryMap;
		setItems: (next: SaleItemRow[]) => void;
		setMap: (next: IncludedAccessoryMap) => void;
		onLinked?: (parentId: string) => void;
	}
): Promise<void> {
	if (
		option.kind !== 'product' ||
		!option.brandId ||
		!canAutoIncludeAccessories(option.productType)
	) {
		return;
	}
	try {
		const accessories = await getAccessoriesForProduct({
			productId: option.id,
			brandId: option.brandId
		});
		const currentItems = state.getItems();
		const currentParent = currentItems.find((item) => item.id === parentItemId);
		if (!currentParent) return;

		const { accessoryItems, linkedIds, addedNames, outOfStockNames } =
			buildIncludedAccessoriesForParent(
				parentItemId,
				currentParent.quantity,
				accessories,
				currentItems
			);
		for (const name of outOfStockNames) {
			toast.warning(`⚠ ${name} no tiene stock disponible y no fue agregado automáticamente.`);
		}
		if (accessoryItems.length === 0) return;

		state.setItems([...currentItems, ...accessoryItems]);
		state.setMap(linkIncludedAccessories(state.getMap(), parentItemId, linkedIds));
		state.onLinked?.(parentItemId);
		if (addedNames.length > 1) {
			toast.info(`✓ Se agregaron automáticamente: ${addedNames.join(', ')}`);
		}
	} catch (error) {
		toast.error(getErrorMessage(error, 'Error cargando accesorios incluidos'));
	}
}

/** Syncs linked accessory quantities when a parent row's quantity changes, warning on stock caps. */
export function syncStep2AccessoryQuantities(
	items: SaleItemRow[],
	map: IncludedAccessoryMap,
	parentId: string,
	quantity: number,
	products: readonly ProductWithRelations[]
): SaleItemRow[] {
	const productList = [...products];
	const productById = (pid: string) => products.find((p) => p.id === pid);
	const { items: synced, cappedIds } = syncIncludedAccessoryQuantities(
		items,
		map,
		parentId,
		quantity,
		(pid, accId) => getAvailableProductStock(items, productList, pid, accId)
	);
	for (const accId of cappedIds) {
		const acc = synced.find((i) => i.id === accId);
		if (!acc || acc.kind !== 'product' || !acc.productId) continue;
		const prod = productById(acc.productId);
		if (!prod) continue;
		const available = getAvailableProductStock(synced, productList, acc.productId, acc.id);
		if (available != null && available < prod.stock) {
			toast.warning(
				`⚠ ${prod.name}: solo quedan ${available} disponibles de ${prod.stock} en stock.`
			);
		} else {
			toast.warning(`⚠ ${prod.name} solo tiene ${prod.stock} en stock.`);
		}
	}
	return synced;
}
