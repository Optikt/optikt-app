import { toast } from 'svelte-sonner';
import { getErrorMessage } from '$lib/utils';
import { getAccessoriesForProduct } from '$lib/remote/brandAccessories.remote';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { SaleItemRow } from '../../newSaleTypes';
import { createEmptyProductItem } from '../../newSaleTypes';
import {
	canAutoIncludeAccessories,
	linkIncludedAccessories,
	syncIncludedAccessoryQuantities,
	type IncludedAccessoryMap
} from '../../includedAccessories';
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

/** Fetches and appends auto-included accessories for a newly added frame/sunglasses row. */
export async function fetchAndLinkIncludedAccessories(
	option: { kind: string; brandId?: string | null; productType?: string; id: string },
	parentItemId: string,
	state: {
		getItems: () => SaleItemRow[];
		getMap: () => IncludedAccessoryMap;
		setItems: (next: SaleItemRow[]) => void;
		setMap: (next: IncludedAccessoryMap) => void;
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
				accessories as unknown as IncludedAccessoryRule[]
			);
		for (const name of outOfStockNames) {
			toast.warning(`⚠ ${name} no tiene stock disponible y no fue agregado automáticamente.`);
		}
		if (accessoryItems.length === 0) return;

		state.setItems([...currentItems, ...accessoryItems]);
		state.setMap(linkIncludedAccessories(state.getMap(), parentItemId, linkedIds));
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
	const productById = (pid: string) => products.find((p) => p.id === pid);
	const { items: synced, cappedIds } = syncIncludedAccessoryQuantities(
		items,
		map,
		parentId,
		quantity,
		(pid) => productById(pid)?.stock
	);
	for (const accId of cappedIds) {
		const acc = synced.find((i) => i.id === accId);
		const prod = acc?.kind === 'product' && acc.productId ? productById(acc.productId) : null;
		if (prod) toast.warning(`⚠ ${prod.name} solo tiene ${prod.stock} en stock.`);
	}
	return synced;
}
