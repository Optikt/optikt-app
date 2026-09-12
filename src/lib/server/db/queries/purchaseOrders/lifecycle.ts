/**
 * Purchase order queries — confirm + cancel.
 * Split from queries/purchaseOrders.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { findPurchaseOrderById } from './orders';
import { computeSettlementDiscountFactor, roundCurrency } from './shared';
import { eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';

import {
	purchaseOrders,
	purchaseOrderItems,
	inventoryLots,
	inventoryMovements,
	products,
	lensCatalogItems,
	type PurchaseOrder
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { PurchaseOrderStatus, PurchaseOrderItemType } from '$lib/shared/enums';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';

import { getNextLotNumber, getNextFifoCost } from '../inventoryLots';
import { nowISO } from '$lib/dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export async function confirmPurchaseOrder(poId: string, confirmedById: string, tx: DbOrTx) {
	// 1. Validate PO is DRAFT
	const po = await findPurchaseOrderById(poId, tx);
	if (!po) throw new Error(`Orden de compra ${poId} no encontrada`);
	if (po.status !== PurchaseOrderStatus.DRAFT) {
		throw new Error(`No se puede confirmar: estado actual es ${po.status}`);
	}
	if (!po.isReadyForReview) {
		throw new Error('El borrador debe marcarse como listo para revisar antes de confirmarlo');
	}

	// 2. Get all items for this PO
	const items = await tx
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.purchaseOrderId, poId));

	if (items.length === 0) {
		throw new Error('No se puede confirmar una orden sin ítems');
	}
	const pendingReview = items.filter((item) => !item.isReviewed).length;
	if (pendingReview > 0) {
		throw new Error(
			`Faltan ${pendingReview} línea(s) por marcar como revisadas antes de confirmar`
		);
	}

	// 3a. Compute settlement-discount factor (applied to each lot's cost on
	//     confirmation so COGS, FIFO, and inventory valuation reflect what we
	//     with the supplier's delivery note.
	const discountFactor = computeSettlementDiscountFactor(items, po);

	// 3. Process each item
	for (const item of items) {
		const netUnitPurchasePrice = roundCurrency(item.unitPurchasePrice * discountFactor);

		// a. Create inventory lot
		const lotNumber = await getNextLotNumber(tx);
		const [lot] = await tx
			.insert(inventoryLots)
			.values({
				lotNumber,
				purchaseOrderItemId: item.id,
				itemType: item.itemType,
				productId: item.productId,
				lensCatalogItemId: item.lensCatalogItemId,
				quantityInitial: item.quantity,
				quantityAvailable: item.quantity,
				unitPurchasePrice: netUnitPurchasePrice,
				unitSalePrice: item.unitSalePrice,
				bcvRateAtPurchase: po.bcvRate,
				isActive: true
			})
			.returning();

		// b. Link lot to PO item
		await tx
			.update(purchaseOrderItems)
			.set({ lotId: lot.id, updatedAt: nowISO() })
			.where(eq(purchaseOrderItems.id, item.id));

		// c. Create PURCHASE_IN movement
		await tx.insert(inventoryMovements).values({
			movementType: InventoryMovementType.PURCHASE_IN,
			lotId: lot.id,
			itemType: item.itemType,
			productId: item.productId,
			lensCatalogItemId: item.lensCatalogItemId,
			quantityDelta: item.quantity,
			quantityBefore: 0,
			quantityAfter: item.quantity,
			referenceType: MovementReferenceType.PURCHASE_ORDER,
			referenceId: po.id,
			createdById: confirmedById
		});

		// d. Update cached stock counter + FIFO-based current purchase price
		// NOTE: currentSalePrice is NOT updated here - it requires explicit user approval
		if (item.itemType === PurchaseOrderItemType.PRODUCT && item.productId) {
			const fifoCost = await getNextFifoCost(item.productId, tx);
			await tx
				.update(products)
				.set({
					stock: sql`${products.stock} + ${item.quantity}`,
					currentPurchasePrice: fifoCost ?? netUnitPurchasePrice,
					updatedAt: nowISO()
				})
				.where(eq(products.id, item.productId));
		} else if (item.itemType === PurchaseOrderItemType.LENS && item.lensCatalogItemId) {
			await tx
				.update(lensCatalogItems)
				.set({
					stock: sql`coalesce(${lensCatalogItems.stock}, 0) + ${item.quantity}`,
					updatedAt: nowISO()
				})
				.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
		}
	}

	// 4. Update PO status
	const [confirmed] = await tx
		.update(purchaseOrders)
		.set({
			status: PurchaseOrderStatus.CONFIRMED,
			isReadyForReview: false,
			confirmedById,
			confirmedAt: nowISO(),
			updatedAt: nowISO()
		})
		.where(eq(purchaseOrders.id, poId))
		.returning();

	return confirmed;
}

// ---------------------------------------------------------------------------
// PO Cancellation (only DRAFT orders can be cancelled)
// ---------------------------------------------------------------------------

export async function cancelPurchaseOrder(
	poId: string,
	executor: DbOrTx = db
): Promise<PurchaseOrder> {
	const po = await findPurchaseOrderById(poId, executor);
	if (!po) throw new Error(`Orden de compra ${poId} no encontrada`);
	if (po.status !== PurchaseOrderStatus.DRAFT) {
		throw new Error(`Solo se pueden cancelar órdenes en estado DRAFT. Estado actual: ${po.status}`);
	}

	const [cancelled] = await executor
		.update(purchaseOrders)
		.set({
			status: PurchaseOrderStatus.CANCELLED,
			isReadyForReview: false,
			updatedAt: nowISO()
		})
		.where(eq(purchaseOrders.id, poId))
		.returning();

	return cancelled;
}
