import { toSaleTotalsLine } from '$lib/remote/sales/helpers';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { findCustomerById } from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import {
	sales,
	saleItems,
	saleItemFreeDetails,
	products,
	lensCatalogItems,
	inventoryMovements
} from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { SaleStatus, UserRole, canManageSaleByOwner } from '$lib/shared/enums';
import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import { computeDiscount } from '$lib/utils';
import { auditService } from '$lib/server/audit';
import { returnToLot } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import { nowISO } from '$lib/dates';
import { insertSaleItem, saleItemFreeDetailsInsertValues } from '$lib/server/sales/saleItemInsert';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import type { UpdateSaleInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Edit an existing sale: update header fields and/or replace items.
 *
 * Strict state/role enforcement:
 * - COMPLETED: blocked entirely.
 * - IN_PROGRESS / READY: only ADMIN/MANAGER may edit.
 * - PENDING: allowed for authorized users.
 *
 * When items change the full inventory is reset (CANCEL_REVERT) and
 * re-consumed (SALE_OUT) inside the same transaction.
 */
export async function updateSaleCore(data: UpdateSaleInput, ctx: ActionContext) {
	// Read validation (outside transaction)
	const existing = await findSaleById(data.id);
	if (!existing) return { success: false as const, error: 'Venta no encontrada' };
	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se puede modificar una venta cancelada' };
	}

	if (!canManageSaleByOwner(ctx.role, ctx.userId, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	if (existing.status === SaleStatus.COMPLETED) {
		return { success: false as const, error: 'No se puede modificar una venta completada' };
	}

	const isAdmin = ctx.role === UserRole.ADMIN || ctx.role === UserRole.MANAGER;
	if (
		(existing.status === SaleStatus.IN_PROGRESS || existing.status === SaleStatus.READY) &&
		!isAdmin
	) {
		return {
			success: false as const,
			error: 'Solo administradores pueden modificar ventas en progreso o listas para retirar'
		};
	}

	// Order number reassignment: admin only (code-only for now, no UI field yet).
	if (data.orderNumber && !isAdmin) {
		return {
			success: false as const,
			error: 'Solo administradores pueden cambiar el número de orden'
		};
	}

	if (data.orderNumber) {
		const [existingOrder] = await db
			.select({ id: sales.id })
			.from(sales)
			.where(eq(sales.orderNumber, data.orderNumber));
		if (existingOrder) {
			return {
				success: false as const,
				error: `El número de orden #${data.orderNumber} ya existe`
			};
		}
	}

	// Payment protection
	const paidAmount = existing.paidAmountBcvUsd;

	// Validate customer reference if changed
	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) return { success: false as const, error: 'Cliente no encontrado' };
	}

	// Calculate new totals
	const hasItemChanges = !!data.items && data.items.length > 0;
	if (data.items && data.items.length === 0) {
		return { success: false as const, error: 'La venta debe tener al menos un artículo' };
	}

	let newSubtotal = existing.subtotal;

	const newDiscount = data.discount ?? existing.discount;
	const newDiscountType = data.discountType ?? existing.discountType;

	let newTotal = Math.max(
		0,
		newSubtotal - computeDiscount(newDiscount, newDiscountType, newSubtotal)
	);

	if (hasItemChanges) {
		const totals = computeSaleTotals(
			data.items!.map((item) =>
				toSaleTotalsLine(item, data.snapshotTaxRate ?? existing.snapshotTaxRate)
			),
			newDiscount,
			newDiscountType
		);
		newSubtotal = totals.subtotal;
		newTotal = totals.total;
	}

	if (newTotal < paidAmount - 0.01) {
		return {
			success: false as const,
			error:
				'La modificación reduce el total por debajo de lo ya cobrado. Por favor cancele esta venta y cree una nueva.'
		};
	}

	// All writes in a single transaction
	const updatedSale = await db.transaction(async (tx) => {
		if (hasItemChanges) {
			// ── 1. Revert all existing SALE_OUT inventory movements ──────────
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

			for (const movement of saleOutMovements) {
				const quantityToReturn = Math.abs(movement.quantityDelta);
				const updatedLot = await returnToLot(movement.lotId, quantityToReturn, tx);

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
						createdById: ctx.userId!
					},
					tx
				);
			}

			// ── 2. Restore cached stock counters ────────────────────────────
			const oldItems = await tx
				.select()
				.from(saleItems)
				.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

			for (const item of oldItems) {
				if (item.productId) {
					const [product] = await tx
						.select({ id: products.id, stock: products.stock })
						.from(products)
						.where(eq(products.id, item.productId));

					if (product && product.stock !== null) {
						await tx
							.update(products)
							.set({ stock: product.stock + item.quantity, updatedAt: nowISO() })
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
							.set({ stock: lens.stock + item.quantity, updatedAt: nowISO() })
							.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
					}
				}
			}

			// ── 3. Soft-delete all existing sale items (cascade handles free_details + child treatments) ──
			await tx
				.update(saleItems)
				.set({ deletedAt: nowISO(), updatedAt: nowISO() })
				.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

			// ── 4. Insert new items + consume inventory ──────────────────────
			const idMap = new Map<string, string>();
			const newIds = new Map<number, string>();
			data.items!.forEach((item, index) => {
				const newId = crypto.randomUUID();
				newIds.set(index, newId);
				if (item.id) idMap.set(item.id, newId);
			});
			for (const [index, item] of data.items!.entries()) {
				const saleItemId = newIds.get(index)!;
				const resolvedParentId = item.parentSaleItemId
					? (idMap.get(item.parentSaleItemId) ?? null)
					: null;

				await insertSaleItem(tx, {
					id: saleItemId,
					saleId: data.id,
					item,
					parentSaleItemId: resolvedParentId,
					prescriptionId: item.prescriptionId ?? null,
					userId: ctx.userId!,
					now: nowISO()
				});

				if (item.itemType === SaleItemType.FREE_ITEM) {
					await tx.insert(saleItemFreeDetails).values(
						saleItemFreeDetailsInsertValues({
							id: crypto.randomUUID(),
							saleItemId,
							category: item.freeItemCategory!,
							description: item.freeItemDescription!,
							enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
							unitCost: item.freeItemUnitCost ?? null,
							supplierId: item.freeItemSupplierId ?? null,
							opticalNotes: item.freeItemOpticalNotes ?? null,
							now: nowISO()
						})
					);
				}
			}

			// ── 5. Recalculate tax snapshot if provided ─────────────────────
			const taxRate = data.snapshotTaxRate ?? existing.snapshotTaxRate;
			const updateData: Record<string, unknown> = {
				subtotal: newSubtotal,
				total: newTotal,
				snapshotTaxRate: taxRate,
				updatedAt: nowISO()
			};

			if (data.customerId) updateData.customerId = data.customerId;
			/** saleDate alias → createdAt (modal already composes day + preserved time) */
			if (data.saleDate) updateData.createdAt = data.saleDate;
			if (data.notes !== undefined) updateData.notes = data.notes;
			if (data.discount !== undefined) updateData.discount = data.discount;
			if (data.discountType !== undefined) updateData.discountType = data.discountType;
			if (data.isCashea !== undefined) updateData.isCashea = data.isCashea;
			if (data.orderNumber !== undefined) updateData.orderNumber = data.orderNumber;

			const [updated] = await tx
				.update(sales)
				.set(updateData)
				.where(eq(sales.id, data.id))
				.returning();

			return updated;
		}

		// ── Header-only update (no item changes) ───────────────────────────
		const headerUpdate: Record<string, unknown> = {
			updatedAt: nowISO()
		};
		if (data.customerId) headerUpdate.customerId = data.customerId;
		/** saleDate alias → createdAt (modal already composes day + preserved time) */
		if (data.saleDate) headerUpdate.createdAt = data.saleDate;
		if (data.notes !== undefined) headerUpdate.notes = data.notes;
		if (data.discount !== undefined) headerUpdate.discount = data.discount;
		if (data.discountType !== undefined) headerUpdate.discountType = data.discountType;
		if (data.snapshotTaxRate !== undefined) headerUpdate.snapshotTaxRate = data.snapshotTaxRate;
		if (data.isCashea !== undefined) headerUpdate.isCashea = data.isCashea;
		if (data.orderNumber !== undefined) headerUpdate.orderNumber = data.orderNumber;

		if (data.discount !== undefined || data.discountType !== undefined) {
			headerUpdate.subtotal = newSubtotal;
			headerUpdate.total = newTotal;
		}

		const [updated] = await tx
			.update(sales)
			.set(headerUpdate)
			.where(eq(sales.id, data.id))
			.returning();

		return updated;
	});

	if (!updatedSale) {
		return { success: false as const, error: 'Error al actualizar la venta' };
	}

	// Audit (best-effort, after transaction succeeds)
	await auditService.logUpdate(
		'sale',
		data.id,
		existing,
		updatedSale,
		{ ...ctx, reason: data.reason },
		{ excludeFields: ['updatedAt', 'deletedAt'] }
	);

	return { success: true as const, sale: updatedSale };
}
