/**
 * Sales remote — cancel lifecycle
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { CancelSaleSchema } from '$lib/schemas/';
import { findSaleById, updateSale as updateSaleQuery } from '$lib/server/db/queries/';

import { db } from '$lib/server/db';
import { saleItems, products, lensCatalogItems } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { SaleStatus, RefundStatus, UserRole, canManageSaleByOwner } from '$lib/shared/enums';

import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';

import { auditService, getAuditContext } from '$lib/server/audit';

import { returnToLot } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';

import { createExpense } from '$lib/server/db/queries/cash';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { inventoryMovements } from '$lib/server/db/schema';

import { nowISO, toISODate, nowUTC } from '$lib/dates';

export const cancelSale = command(CancelSaleSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	const existing = await findSaleById(data.id);
	if (!existing) {
		return { success: false, error: 'Venta no encontrada' };
	}

	if (!canManageSaleByOwner(user.role, user.id, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para cancelar esta venta' };
	}

	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false, error: 'La venta ya está cancelada' };
	}

	const refundBcvRate =
		existing.paidAmountBcvUsd > 0 && data.refundStatus === RefundStatus.REFUNDED
			? await getExchangeRateValue('USD')
			: null;

	await db.transaction(async (tx) => {
		const now = nowISO();

		// Get all items for this sale
		const items = await tx
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

		// Find all SALE_OUT movements for this sale to revert lots
		const saleOutMovements = await tx
			.select()
			.from(inventoryMovements)
			.where(
				and(
					eq(inventoryMovements.referenceType, MovementReferenceType.SALE),
					eq(inventoryMovements.referenceId, data.id),
					eq(inventoryMovements.movementType, InventoryMovementType.SALE_OUT)
				)
			);

		// Revert lot consumption for each SALE_OUT movement
		for (const movement of saleOutMovements) {
			const quantityToReturn = Math.abs(movement.quantityDelta);
			const updatedLot = await returnToLot(movement.lotId, quantityToReturn, tx);

			// Create CANCEL_REVERT movement
			await createInventoryMovement(
				{
					movementType: InventoryMovementType.CANCEL_REVERT,
					lotId: movement.lotId,
					itemType: 'PRODUCT',
					productId: movement.productId!,
					quantityDelta: quantityToReturn,
					quantityBefore: updatedLot.quantityAvailable - quantityToReturn,
					quantityAfter: updatedLot.quantityAvailable,
					referenceType: MovementReferenceType.SALE,
					referenceId: data.id,
					createdById: context.userId!
				},
				tx
			);
		}

		// Restore cached stock for product and lens items
		for (const item of items) {
			if (item.productId) {
				const [product] = await tx
					.select({ id: products.id, stock: products.stock })
					.from(products)
					.where(eq(products.id, item.productId));

				if (product && product.stock !== null) {
					await tx
						.update(products)
						.set({ stock: product.stock + item.quantity, updatedAt: now })
						.where(eq(products.id, item.productId));
				}
			}

			if (item.lensCatalogItemId) {
				const [lens] = await tx
					.select({
						id: lensCatalogItems.id,
						stock: lensCatalogItems.stock,
						inventoryMode: lensCatalogItems.inventoryMode
					})
					.from(lensCatalogItems)
					.where(eq(lensCatalogItems.id, item.lensCatalogItemId));

				if (lens && lens.inventoryMode === 'STOCK' && lens.stock !== null) {
					await tx
						.update(lensCatalogItems)
						.set({ stock: lens.stock + item.quantity, updatedAt: now })
						.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
				}
			}
		}

		// Update sale status, cancellation info, and refund disposition
		const hasPriorPayments = existing.paidAmountBcvUsd > 0;
		const refundStatus = hasPriorPayments ? data.refundStatus : RefundStatus.NO_PAYMENT;

		await updateSaleQuery(
			data.id,
			{
				status: SaleStatus.CANCELLED,
				cancellationReason: data.reason,
				cancelledAt: now,
				cancelledById: context.userId!,
				refundStatus,
				refundAmount: hasPriorPayments ? existing.paidAmountBcvUsd : null,
				refundNotes: hasPriorPayments ? (data.refundNotes ?? null) : null,
				refundedAt: now,
				refundedById: context.userId!
			},
			tx
		);

		// If the customer was actually reimbursed, log the refund as a USD
		// cash expense so the P&L reflects the cash leaving the box. The
		// payments themselves remain active (cash physically arrived) and the
		// refund offsets them on the egress side, preserving the trail.
		if (
			hasPriorPayments &&
			refundStatus === RefundStatus.REFUNDED &&
			existing.paidAmountBcvUsd > 0
		) {
			await createExpense(
				{
					category: 'REFUND',
					description: `Reembolso venta #${existing.orderNumber}: ${data.reason}`,
					currency: 'USD',
					amount: existing.paidAmountBcvUsd,
					amountUsd: existing.paidAmountBcvUsd,
					exchangeRate: null,
					bcvRate: refundBcvRate,
					rateType: null,
					expenseDate: toISODate(nowUTC()),
					registeredById: context.userId!,
					reference: `SALE:${existing.id}`,
					notes: data.refundNotes ?? null
				},
				tx
			);
		}
	});

	// Audit logs (best-effort, after transaction succeeds)
	const updated = await findSaleById(data.id);
	if (updated) {
		await auditService.logUpdate('sale', data.id, existing, updated, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	return { success: true };
});

/**
 * Update the internal cost fields of a sale item.
 * Allows editing snapshotBaseCost, snapshotMountingPrice, snapshotShippingPrice,
 * and shippingCostPending after a sale has been created.
 */
