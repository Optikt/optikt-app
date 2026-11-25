import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { lockSaleForGroups } from '$lib/server/db/queries/sales/itemGroups';
import { updateSale as updateSaleQuery } from '$lib/server/db/queries/sales/writes';
import { db } from '$lib/server/db';
import { saleItems, products, lensCatalogItems } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { SaleStatus, RefundStatus, canManageSaleByOwner } from '$lib/shared/enums';
import { auditService } from '$lib/server/audit';
import { revertSaleInventory } from '$lib/server/sales/revertSaleInventory';
import { createExpense } from '$lib/server/db/queries/cash/expenses';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { nowISO, toISODate, nowUTC } from '$lib/dates';
import type { CancelSaleInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

class SaleCancelError extends Error {}

export async function cancelSaleCore(data: CancelSaleInput, ctx: ActionContext) {
	const existing = await findSaleById(data.id);
	if (!existing) {
		return { success: false, error: 'Venta no encontrada' };
	}

	if (!canManageSaleByOwner(ctx.role, ctx.userId, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para cancelar esta venta' };
	}

	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false, error: 'La venta ya está cancelada' };
	}

	const refundBcvRate =
		data.refundStatus === RefundStatus.REFUNDED ? await getExchangeRateValue('USD') : null;

	let beforeSale = existing;
	try {
		await db.transaction(async (tx) => {
			// Lock the sale row first so cancelSale matches updateSale/saveSaleItemGroups
			// lock order (sales → inventory_lots) and re-checks status inside the tx.
			const locked = await lockSaleForGroups(data.id, tx);
			if (!locked) throw new SaleCancelError('Venta no encontrada');
			if (locked.status === SaleStatus.CANCELLED) {
				throw new SaleCancelError('La venta ya está cancelada');
			}
			const freshSale = await findSaleById(data.id, {}, tx);
			if (!freshSale) throw new SaleCancelError('Venta no encontrada');
			beforeSale = freshSale;

			const now = nowISO();

			// Get all items for this sale
			const items = await tx
				.select()
				.from(saleItems)
				.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

			// Return only what this sale still holds (net outstanding per lot —
			// movements already reverted by a prior edit are never re-returned).
			await revertSaleInventory(tx, data.id, ctx.userId!, { origin: 'cancel' });

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

			// Update sale status, cancellation info, and refund disposition (from locked row)
			const hasPriorPayments = beforeSale.paidAmountBcvUsd > 0;
			const refundStatus = hasPriorPayments ? data.refundStatus : RefundStatus.NO_PAYMENT;

			await updateSaleQuery(
				data.id,
				{
					status: SaleStatus.CANCELLED,
					cancellationReason: data.reason,
					cancelledAt: now,
					cancelledById: ctx.userId!,
					refundStatus,
					refundAmount: hasPriorPayments ? beforeSale.paidAmountBcvUsd : null,
					refundNotes: hasPriorPayments ? (data.refundNotes ?? null) : null,
					refundedAt: now,
					refundedById: ctx.userId!
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
				beforeSale.paidAmountBcvUsd > 0
			) {
				await createExpense(
					{
						category: 'REFUND',
						description: `Reembolso venta #${beforeSale.orderNumber}: ${data.reason}`,
						currency: 'USD',
						amount: beforeSale.paidAmountBcvUsd,
						amountUsd: beforeSale.paidAmountBcvUsd,
						exchangeRate: null,
						bcvRate: refundBcvRate,
						rateType: null,
						expenseDate: toISODate(nowUTC()),
						registeredById: ctx.userId!,
						reference: `SALE:${beforeSale.id}`,
						notes: data.refundNotes ?? null
					},
					tx
				);
			}
		});
	} catch (error) {
		if (error instanceof SaleCancelError) {
			return { success: false as const, error: error.message };
		}
		throw error;
	}

	// Audit logs (best-effort, after transaction succeeds)
	const updated = await findSaleById(data.id);
	if (updated) {
		await auditService.logUpdate('sale', data.id, beforeSale, updated, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	return { success: true };
}
