/**
 * Shared FIFO consumption logic for sales.
 *
 * Extracted to avoid duplication between createSale and convertQuoteToSale.
 * Both callers pass a transaction instance and get back lot details for
 * snapshot fields on sale_items.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { products, lensCatalogItems } from '$lib/server/db/schema';
import { getActiveLotsFifo, consumeFromLot } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import { planFifoConsumption } from '$lib/utils/inventory';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { DbOrTx } from '$lib/server/db/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FifoSaleItem {
	productId?: string | null;
	lensCatalogItemId?: string | null;
	itemType: string;
	quantity: number;
}

export interface FifoConsumptionResult {
	lotId: string | null;
	snapshotCostTotal: number | null;
	snapshotCostUnit: number | null;
	snapshotLotsCount: number | null;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Run FIFO lot consumption for a single sale item inside a transaction.
 *
 * Handles three scenarios:
 * 1. PRODUCT items: full FIFO consumption (lots + movements + stock cache)
 * 2. Non-PRODUCT items with productId: simple stock decrement (no lots)
 * 3. STOCK-mode lens items: simple stock decrement (no lots)
 *
 * @param tx      — drizzle transaction instance
 * @param saleId  — the sale id for movement references
 * @param item    — item with productId, lensCatalogItemId, itemType, quantity
 * @param userId  — for movement audit trail
 * @returns lot details for snapshot fields on the sale_item row
 */
export async function consumeFifoForSaleItem(
	tx: DbOrTx,
	saleId: string,
	item: FifoSaleItem,
	userId: string
): Promise<FifoConsumptionResult> {
	const result: FifoConsumptionResult = {
		lotId: null,
		snapshotCostTotal: null,
		snapshotCostUnit: null,
		snapshotLotsCount: null
	};

	// --- FIFO lot consumption for PRODUCT items ---
	if (item.productId && item.itemType === SaleItemType.PRODUCT) {
		const [product] = await tx
			.select({ id: products.id, stock: products.stock, name: products.name })
			.from(products)
			.where(and(eq(products.id, item.productId), isNull(products.deletedAt)));

		if (!product) {
			throw new Error(`Producto ${item.productId} no encontrado`);
		}

		if (product.stock === null || product.stock < item.quantity) {
			throw new Error(
				`Stock insuficiente para ${product.name}. Disponible: ${product.stock ?? 0}, solicitado: ${item.quantity}`
			);
		}

		const lots = await getActiveLotsFifo(item.productId, tx);
		const plan = planFifoConsumption(lots, item.quantity);

		for (const alloc of plan.allocations) {
			const updatedLot = await consumeFromLot(alloc.lotId, alloc.quantityToConsume, tx);

			await createInventoryMovement(
				{
					movementType: InventoryMovementType.SALE_OUT,
					lotId: alloc.lotId,
					itemType: 'PRODUCT',
					productId: item.productId,
					quantityDelta: -alloc.quantityToConsume,
					quantityBefore: alloc.quantityBeforeConsume,
					quantityAfter: updatedLot.quantityAvailable,
					referenceType: MovementReferenceType.SALE,
					referenceId: saleId,
					createdById: userId
				},
				tx
			);
		}

		result.lotId = plan.primaryLotId;
		result.snapshotCostTotal = plan.costTotal;
		result.snapshotCostUnit = plan.costUnit;
		result.snapshotLotsCount = plan.lotsCount;

		// Update cached stock counter
		const newStock = product.stock - item.quantity;
		await tx
			.update(products)
			.set({ stock: newStock, updatedAt: new Date() })
			.where(eq(products.id, item.productId));
	} else if (item.productId) {
		// Non-PRODUCT type but has productId (e.g. treatment linked to a product frame).
		// Only decrements the cached counter — no FIFO lots involved.
		const [product] = await tx
			.select({ id: products.id, stock: products.stock })
			.from(products)
			.where(and(eq(products.id, item.productId), isNull(products.deletedAt)));

		if (!product) {
			throw new Error(`Producto ${item.productId} no encontrado`);
		}

		if (product.stock !== null) {
			const newStock = product.stock - item.quantity;
			if (newStock < 0) {
				throw new Error(
					`Stock insuficiente para el producto. Disponible: ${product.stock}, solicitado: ${item.quantity}`
				);
			}
			await tx
				.update(products)
				.set({ stock: newStock, updatedAt: new Date() })
				.where(eq(products.id, item.productId));
		}
	}

	// Decrement stock for lens catalog items with STOCK inventory mode
	if (item.lensCatalogItemId) {
		const [lens] = await tx
			.select({
				id: lensCatalogItems.id,
				stock: lensCatalogItems.stock,
				inventoryMode: lensCatalogItems.inventoryMode
			})
			.from(lensCatalogItems)
			.where(
				and(eq(lensCatalogItems.id, item.lensCatalogItemId), isNull(lensCatalogItems.deletedAt))
			);

		if (!lens) {
			throw new Error(`Lente ${item.lensCatalogItemId} no encontrado`);
		}

		if (lens.inventoryMode === 'STOCK') {
			const currentStock = lens.stock ?? 0;
			const newStock = currentStock - item.quantity;
			if (newStock < 0) {
				throw new Error(
					`Stock insuficiente para el lente. Disponible: ${currentStock}, solicitado: ${item.quantity}`
				);
			}
			await tx
				.update(lensCatalogItems)
				.set({ stock: newStock, updatedAt: new Date() })
				.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
		}
	}

	return result;
}
