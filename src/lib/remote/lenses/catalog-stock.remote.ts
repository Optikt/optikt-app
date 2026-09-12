/**
 * Lenses remote — catalog delete + stock adjustments
 * Split from lenses.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { command } from '$app/server';
import { requireAdmin, requireRole } from '$lib/server/guards';
import { eq, desc, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { softDelete } from '$lib/server/db/queries/deletedItems';
import { inventoryLots, lensCatalogItems } from '$lib/server/db/schema';
import { LensIdSchema } from '$lib/schemas/lenses';
import { ManualLensAdjustmentSchema } from '$lib/schemas/inventory';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import {
	createInventoryLot,
	consumeFromLot,
	getActiveLensLotsFifo,
	getNextLotNumber,
	returnToLot
} from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import {
	createPurchaseOrder,
	createPurchaseOrderItem,
	getNextPONumber
} from '$lib/server/db/queries/purchaseOrders';

import { auditService, getAuditContext } from '$lib/server/audit';
import { nowISO, toISODate, nowUTC } from '$lib/dates';
import {
	ADJUSTMENT_REPORT_CATEGORIES,
	AdjustmentReason,
	InventoryMovementType,
	MovementReferenceType,
	PurchaseDocumentType,
	PurchaseOrderItemType,
	PurchaseOrderStatus,
	UserRole
} from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';

export const deleteLensCatalogItemById = command(LensIdSchema, async (data): Promise<void> => {
	requireAdmin();

	const existing = await findLensCatalogItemById(data.id);
	if (!existing) throw new Error('Item de catálogo no encontrado');

	await db.transaction(async (tx) => {
		const ok = await softDelete('lens_catalog_item', data.id, getAuditContext().userId ?? null, tx);
		if (!ok) throw new Error('Error eliminando item de catálogo');
	});

	await auditService.logDelete('lens_catalog_item', existing, getAuditContext());
});

export const adjustLensStock = command(ManualLensAdjustmentSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN);

	const { lensCatalogItemId, adjustmentType, quantity, reason, notes } = data;
	const item = await findLensCatalogItemById(lensCatalogItemId);

	if (!item) {
		return { success: false as const, error: 'Lente no encontrado' };
	}

	if (item.inventoryMode !== 'STOCK') {
		return {
			success: false as const,
			error: 'Solo se pueden ajustar lentes configurados en modo STOCK'
		};
	}

	const isOutflow = adjustmentType === InventoryMovementType.ADJUSTMENT_OUT;
	const quantityDelta = isOutflow ? -quantity : quantity;
	const isCustomerReturn = reason === AdjustmentReason.CUSTOMER_RETURN;
	const formattedNotes = `${reason}: ${notes}`;

	try {
		const result = await db.transaction(async (tx) => {
			const activeLots = await getActiveLensLotsFifo(lensCatalogItemId, tx);
			let targetLot = activeLots[0] ?? null;

			if (!targetLot && isOutflow) {
				throw new Error('No hay lote activo para registrar una reducción de stock');
			}

			if (!targetLot) {
				const [templateLot] = await tx
					.select()
					.from(inventoryLots)
					.where(eq(inventoryLots.lensCatalogItemId, lensCatalogItemId))
					.orderBy(desc(inventoryLots.createdAt), desc(inventoryLots.lotNumber))
					.limit(1);

				let purchaseOrderItemId = templateLot?.purchaseOrderItemId ?? null;
				const now = nowISO();

				if (!purchaseOrderItemId) {
					const orderNumber = await getNextPONumber(tx);
					const purchaseOrder = await createPurchaseOrder(
						{
							id: crypto.randomUUID(),
							orderNumber,
							supplierId: item.supplierId,
							status: PurchaseOrderStatus.CONFIRMED,
							documentType: PurchaseDocumentType.INVOICE,
							orderDate: toISODate(nowUTC()),
							bcvRate: 0,
							notes: 'Soporte técnico para ajuste manual de lente STOCK',
							createdById: user.id,
							confirmedById: user.id,
							confirmedAt: now,
							createdAt: now,
							updatedAt: now
						},
						tx
					);

					const purchaseOrderItem = await createPurchaseOrderItem(
						{
							id: crypto.randomUUID(),
							purchaseOrderId: purchaseOrder.id,
							lineNumber: 1,
							itemType: PurchaseOrderItemType.LENS,
							productId: null,
							lensCatalogItemId,
							quantity,
							unitPurchasePrice: 0,
							unitSalePrice: item.salePrice ?? 0,
							appliesIva: item.isTaxable,
							ivaRate: 16,
							createdAt: now,
							updatedAt: now
						},
						tx
					);

					purchaseOrderItemId = purchaseOrderItem.id;
				}

				const lotNumber = await getNextLotNumber(tx);
				targetLot = await createInventoryLot(
					{
						lotNumber,
						purchaseOrderItemId,
						itemType: PurchaseOrderItemType.LENS,
						productId: null,
						lensCatalogItemId,
						quantityInitial: quantity,
						quantityAvailable: quantity,
						unitPurchasePrice: 0,
						unitSalePrice: item.salePrice ?? 0,
						bcvRateAtPurchase: 0,
						isActive: true,
						createdAt: now,
						updatedAt: now
					},
					tx
				);

				const movement = await createInventoryMovement(
					{
						movementType: InventoryMovementType.ADJUSTMENT_IN,
						lotId: targetLot.id,
						itemType: targetLot.itemType,
						productId: null,
						lensCatalogItemId,
						quantityDelta,
						quantityBefore: 0,
						quantityAfter: targetLot.quantityAvailable,
						referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
						referenceId: targetLot.id,
						notes: formattedNotes,
						createdById: user.id
					},
					tx
				);

				await tx
					.update(lensCatalogItems)
					.set({
						stock: sql`coalesce(${lensCatalogItems.stock}, 0) + ${quantityDelta}`,
						updatedAt: now
					})
					.where(eq(lensCatalogItems.id, lensCatalogItemId));

				return { movement, lotId: targetLot.id, newQuantityAvailable: targetLot.quantityAvailable };
			}

			if (isOutflow && quantity > targetLot.quantityAvailable) {
				throw new Error(
					`Stock insuficiente. Disponible: ${targetLot.quantityAvailable}, solicitado: ${quantity}`
				);
			}

			const quantityBefore = targetLot.quantityAvailable;
			const updatedLot = isOutflow
				? await consumeFromLot(targetLot.id, quantity, tx)
				: await returnToLot(targetLot.id, quantity, tx);

			const unitCostAtAdjustment =
				isOutflow && !isCustomerReturn ? targetLot.unitPurchasePrice : null;
			const totalCostAtAdjustment =
				unitCostAtAdjustment != null ? unitCostAtAdjustment * quantity : null;
			const adjustmentReportCategory = isOutflow
				? ADJUSTMENT_REPORT_CATEGORIES[reason]
				: isCustomerReturn
					? ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.CUSTOMER_RETURN]
					: null;

			const movement = await createInventoryMovement(
				{
					movementType: adjustmentType,
					lotId: targetLot.id,
					itemType: targetLot.itemType,
					productId: null,
					lensCatalogItemId,
					quantityDelta,
					quantityBefore,
					quantityAfter: updatedLot.quantityAvailable,
					referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
					referenceId: targetLot.id,
					notes: formattedNotes,
					unitCostAtAdjustment,
					totalCostAtAdjustment,
					adjustmentReportCategory,
					createdById: user.id
				},
				tx
			);

			await tx
				.update(lensCatalogItems)
				.set({
					stock: sql`coalesce(${lensCatalogItems.stock}, 0) + ${quantityDelta}`,
					updatedAt: nowISO()
				})
				.where(eq(lensCatalogItems.id, lensCatalogItemId));

			return {
				movement,
				lotId: targetLot.id,
				newQuantityAvailable: updatedLot.quantityAvailable
			};
		});

		return {
			success: true as const,
			lensCatalogItemId,
			lotId: result.lotId,
			newQuantityAvailable: result.newQuantityAvailable,
			movementId: result.movement.id
		};
	} catch (error) {
		return { success: false as const, error: getErrorMessage(error) };
	}
});
