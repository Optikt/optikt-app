/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: sale items.
 */
import type { SaleItemWithDetails } from './types';
import { eq, isNull, and } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';
import {
	saleItems,
	saleItemFreeDetails,
	products,
	lensCatalogItems,
	supplierTreatments,
	type SaleItem,
	type NewSaleItem
} from '$lib/server/db/schema';

// ============================================================================
// SALE ITEMS
// ============================================================================

/**
 * Get sale items with product AND lens catalog info AND free item details
 */
export async function getSaleItemsWithDetails(saleId: string): Promise<SaleItemWithDetails[]> {
	const results = await db
		.select({
			item: saleItems,
			product: { id: products.id, name: products.name, sku: products.sku },
			lensCatalogItem: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				type: lensCatalogItems.type
			},
			supplierTreatment: {
				id: supplierTreatments.id,
				name: supplierTreatments.name,
				category: supplierTreatments.category
			},
			freeDetails: saleItemFreeDetails
		})
		.from(saleItems)
		.leftJoin(products, eq(saleItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(saleItems.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(supplierTreatments, eq(saleItems.supplierTreatmentId, supplierTreatments.id))
		.leftJoin(saleItemFreeDetails, eq(saleItems.id, saleItemFreeDetails.saleItemId))
		.where(and(eq(saleItems.saleId, saleId), isNull(saleItems.deletedAt)));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null,
		lensCatalogItem: r.lensCatalogItem?.id ? r.lensCatalogItem : null,
		supplierTreatment: r.supplierTreatment?.id ? r.supplierTreatment : null,
		freeDetails: r.freeDetails?.id ? r.freeDetails : null
	}));
}

/**
 * Create a sale item
 */
export async function createSaleItem(data: NewSaleItem): Promise<SaleItem> {
	const now = nowISO();
	const [item] = await db
		.insert(saleItems)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return item;
}

/**
 * Create multiple sale items
 */
export async function createSaleItems(
	items: NewSaleItem[],
	executor: DbOrTx = db
): Promise<SaleItem[]> {
	const now = nowISO();
	return await executor
		.insert(saleItems)
		.values(
			items.map((item) => ({
				...item,
				id: crypto.randomUUID(),
				createdAt: now,
				updatedAt: now
			}))
		)
		.returning();
}

/**
 * Find a sale item by ID
 */
export async function findSaleItemById(
	id: string,
	executor: DbOrTx = db
): Promise<SaleItem | null> {
	const [item] = await executor
		.select()
		.from(saleItems)
		.where(and(eq(saleItems.id, id), isNull(saleItems.deletedAt)));
	return item ?? null;
}

/**
 * Soft-delete a sale item by ID (sets deletedAt).
 * Returns the deleted item or null if not found.
 */
export async function deleteSaleItem(id: string, executor: DbOrTx = db): Promise<SaleItem | null> {
	const [item] = await executor
		.update(saleItems)
		.set({ deletedAt: nowISO(), updatedAt: nowISO() })
		.where(and(eq(saleItems.id, id), isNull(saleItems.deletedAt)))
		.returning();
	return item ?? null;
}

/**
 * Update a sale item's internal cost fields
 */
export async function updateSaleItemCosts(
	id: string,
	data: {
		snapshotBaseCost: number | null;
		snapshotMountingPrice: number | null;
		snapshotShippingPrice: number | null;
		snapshotCostTotal: number | null;
		snapshotCostUnit: number | null;
		shippingCostPending: boolean;
	},
	executor: DbOrTx = db
): Promise<SaleItem | null> {
	const [item] = await executor
		.update(saleItems)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(saleItems.id, id))
		.returning();
	return item ?? null;
}

// ============================================================================
