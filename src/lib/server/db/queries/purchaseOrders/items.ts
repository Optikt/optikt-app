/**
 * Purchase order queries — order items.
 * Split from queries/purchaseOrders.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { PurchaseOrderItemDraftInput, PurchaseOrderItemWithProduct } from './types';
import { eq, asc } from 'drizzle-orm';

import { db } from '$lib/server/db';

import {
	purchaseOrders,
	purchaseOrderItems,
	inventoryLots,
	products,
	lensCatalogItems,
	type PurchaseOrder,
	type PurchaseOrderItem,
	type NewPurchaseOrderItem
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';

import { assignPurchaseOrderLineNumbers } from '$lib/shared/purchaseOrderLineNumbers';

import { nowISO } from '$lib/dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export async function createPurchaseOrderItem(
	data: NewPurchaseOrderItem,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem> {
	const [item] = await executor.insert(purchaseOrderItems).values(data).returning();
	return item;
}

export async function createPurchaseOrderItems(
	items: NewPurchaseOrderItem[],
	executor: DbOrTx = db
): Promise<PurchaseOrderItem[]> {
	if (items.length === 0) return [];
	return executor.insert(purchaseOrderItems).values(items).returning();
}

export async function getPurchaseOrderItems(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderItemWithProduct[]> {
	const results = await executor
		.select({
			item: purchaseOrderItems,
			product: {
				id: products.id,
				name: products.name,
				sku: products.sku,
				personalCode: products.personalCode
			},
			lensCatalogItem: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				type: lensCatalogItems.type
			}
		})
		.from(purchaseOrderItems)
		.leftJoin(products, eq(purchaseOrderItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(purchaseOrderItems.lensCatalogItemId, lensCatalogItems.id))
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
		.orderBy(asc(purchaseOrderItems.lineNumber), asc(purchaseOrderItems.id));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null,
		lensCatalogItem: r.lensCatalogItem?.id ? r.lensCatalogItem : null
	}));
}

export async function findPurchaseOrderIdByLotId(
	lotId: string,
	executor: DbOrTx = db
): Promise<string | null> {
	const [result] = await executor
		.select({ purchaseOrderId: purchaseOrderItems.purchaseOrderId })
		.from(inventoryLots)
		.innerJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
		.where(eq(inventoryLots.id, lotId));

	return result?.purchaseOrderId ?? null;
}

export async function updatePurchaseOrderItem(
	id: string,
	data: Partial<PurchaseOrderItem>,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem> {
	const [item] = await executor
		.update(purchaseOrderItems)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(purchaseOrderItems.id, id))
		.returning();
	return item;
}

export async function deletePurchaseOrderItem(id: string, executor: DbOrTx = db): Promise<void> {
	await executor.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
}

export async function findPurchaseOrderItemById(
	id: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem | null> {
	const [row] = await executor
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.id, id))
		.limit(1);
	return row ?? null;
}

type PurchaseOrderItemMaterialSnapshot = Pick<
	PurchaseOrderItem,
	| 'itemType'
	| 'productId'
	| 'lensCatalogItemId'
	| 'quantity'
	| 'unitPurchasePrice'
	| 'unitPurchasePriceAlt'
	| 'unitSalePrice'
	| 'appliesIva'
	| 'ivaRate'
>;

export function resolvePurchaseOrderItemReviewedState(
	previous: (PurchaseOrderItemMaterialSnapshot & Pick<PurchaseOrderItem, 'isReviewed'>) | undefined,
	requested: Pick<PurchaseOrderItemDraftInput, 'isReviewed'>,
	next: PurchaseOrderItemMaterialSnapshot
): boolean {
	if (!previous) {
		return requested.isReviewed ?? false;
	}

	const materialChanged =
		previous.itemType !== next.itemType ||
		previous.productId !== next.productId ||
		previous.lensCatalogItemId !== next.lensCatalogItemId ||
		previous.quantity !== next.quantity ||
		previous.unitPurchasePrice !== next.unitPurchasePrice ||
		previous.unitPurchasePriceAlt !== next.unitPurchasePriceAlt ||
		previous.unitSalePrice !== next.unitSalePrice ||
		previous.appliesIva !== next.appliesIva ||
		previous.ivaRate !== next.ivaRate;

	if (materialChanged) {
		return false;
	}

	return requested.isReviewed ?? previous.isReviewed ?? false;
}

export function resolvePurchaseOrderItemZeroPriceIntentionalState(
	previous:
		| (PurchaseOrderItemMaterialSnapshot & Pick<PurchaseOrderItem, 'isZeroPriceIntentional'>)
		| undefined,
	requested: Pick<PurchaseOrderItemDraftInput, 'isZeroPriceIntentional'>,
	next: PurchaseOrderItemMaterialSnapshot
): boolean {
	const hasZeroPrice =
		Number(next.unitPurchasePrice || 0) === 0 || Number(next.unitSalePrice || 0) === 0;

	if (!hasZeroPrice) {
		return false;
	}

	if (!previous) {
		return requested.isZeroPriceIntentional ?? false;
	}

	const zeroPriceContextChanged =
		previous.itemType !== next.itemType ||
		previous.productId !== next.productId ||
		previous.lensCatalogItemId !== next.lensCatalogItemId ||
		previous.unitPurchasePrice !== next.unitPurchasePrice ||
		previous.unitPurchasePriceAlt !== next.unitPurchasePriceAlt ||
		previous.unitSalePrice !== next.unitSalePrice;

	if (zeroPriceContextChanged) {
		return false;
	}

	return requested.isZeroPriceIntentional ?? previous.isZeroPriceIntentional ?? false;
}

export async function replacePurchaseOrderItems(
	purchaseOrderId: string,
	items: PurchaseOrderItemDraftInput[],
	executor: DbOrTx = db
): Promise<PurchaseOrderItemWithProduct[]> {
	const numberedItems = assignPurchaseOrderLineNumbers(items);
	const existingItems = await executor
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

	const existingIds = new Set(existingItems.map((item) => item.id));
	const incomingIds = new Set(
		numberedItems.map((item) => item.id).filter((id): id is string => Boolean(id))
	);

	for (const id of incomingIds) {
		if (!existingIds.has(id)) {
			throw new Error(`El ítem ${id} no pertenece a esta orden de compra`);
		}
	}

	for (const existing of existingItems) {
		if (!incomingIds.has(existing.id)) {
			await deletePurchaseOrderItem(existing.id, executor);
		}
	}

	const existingById = new Map(existingItems.map((existing) => [existing.id, existing]));

	for (const item of numberedItems) {
		const itemData = {
			lineNumber: item.lineNumber,
			itemType: item.itemType,
			productId: item.productId,
			lensCatalogItemId: item.lensCatalogItemId,
			quantity: item.quantity,
			unitPurchasePrice: item.unitPurchasePrice,
			unitPurchasePriceAlt: item.unitPurchasePriceAlt ?? null,
			unitSalePrice: item.unitSalePrice,
			appliesIva: item.appliesIva,
			ivaRate: item.ivaRate
		};
		const previous = item.id ? existingById.get(item.id) : undefined;
		const nextReviewed = resolvePurchaseOrderItemReviewedState(previous, item, itemData);
		const nextZeroPriceIntentional = resolvePurchaseOrderItemZeroPriceIntentionalState(
			previous,
			item,
			itemData
		);

		if (item.id) {
			await updatePurchaseOrderItem(
				item.id,
				{
					...itemData,
					isReviewed: nextReviewed,
					isZeroPriceIntentional: nextZeroPriceIntentional
				},
				executor
			);
		} else {
			await createPurchaseOrderItem(
				{
					purchaseOrderId,
					...itemData,
					isReviewed: nextReviewed,
					isZeroPriceIntentional: nextZeroPriceIntentional
				},
				executor
			);
		}
	}

	return getPurchaseOrderItems(purchaseOrderId, executor);
}

export async function setPurchaseOrderItemReviewed(
	itemId: string,
	isReviewed: boolean,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem> {
	const [updated] = await executor
		.update(purchaseOrderItems)
		.set({ isReviewed, updatedAt: nowISO() })
		.where(eq(purchaseOrderItems.id, itemId))
		.returning();
	return updated;
}

export async function clearPurchaseOrderItemsReviewed(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<void> {
	await executor
		.update(purchaseOrderItems)
		.set({ isReviewed: false, updatedAt: nowISO() })
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

export async function setPurchaseOrderReadyForReview(
	id: string,
	isReadyForReview: boolean,
	executor: DbOrTx = db,
	clearReviewed: boolean = false
): Promise<PurchaseOrder> {
	if (clearReviewed) {
		await clearPurchaseOrderItemsReviewed(id, executor);
	}
	const [po] = await executor
		.update(purchaseOrders)
		.set({ isReadyForReview, updatedAt: nowISO() })
		.where(eq(purchaseOrders.id, id))
		.returning();
	return po;
}

// ---------------------------------------------------------------------------
