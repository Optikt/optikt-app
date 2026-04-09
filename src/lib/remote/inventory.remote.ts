/**
 * Inventory Remote Functions
 * Server-side functions for manual inventory adjustments and movement history
 */
import { command, query } from '$app/server';
import {
	ManualAdjustmentSchema,
	ListInventoryMovementsSchema,
	RevertLotSchema
} from '$lib/schemas/inventory';
import { requireRole } from '$lib/server/guards';
import { db } from '$lib/server/db';
import { findLotById } from '$lib/server/db/queries/inventoryLots';
import {
	createInventoryMovement,
	getMovementsWithDetails,
	countInventoryMovements
} from '$lib/server/db/queries/inventoryMovements';
import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
import { inventoryLots, products } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
	InventoryMovementType,
	MovementReferenceType,
	AdjustmentReason,
	ADJUSTMENT_REPORT_CATEGORIES,
	UserRole
} from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';
import type { PaginatedResult } from '$lib/types';
import { nowISO } from '$lib/dates';

// ============================================================================
// QUERIES
// ============================================================================

export const listInventoryMovements = query(
	ListInventoryMovementsSchema,
	async (data): Promise<PaginatedResult<MovementWithDetails>> => {
		const { page, perPage } = data;
		const filterOptions = {
			lotId: data.lotId ?? undefined,
			productId: data.productId ?? undefined,
			lensCatalogItemId: data.lensCatalogItemId ?? undefined,
			movementType: data.movementType ?? undefined,
			referenceType: data.referenceType ?? undefined,
			dateFrom: data.dateFrom ?? undefined,
			dateTo: data.dateTo ?? undefined
		};
		const [items, total] = await Promise.all([
			getMovementsWithDetails({
				...filterOptions,
				limit: perPage,
				offset: (page - 1) * perPage
			}),
			countInventoryMovements(filterOptions)
		]);
		const totalPages = Math.ceil(total / perPage);
		return { items, total, page, perPage, totalPages };
	}
);

// ============================================================================
// COMMANDS
// ============================================================================

export const createManualAdjustmentCmd = command(ManualAdjustmentSchema, async (data) => {
	// Only ADMIN and SUPERADMIN can create manual adjustments
	const user = requireRole(UserRole.SUPERADMIN, UserRole.ADMIN);

	const { lotId, adjustmentType, quantity, reason, notes } = data;

	// Validate lot exists
	const lot = await findLotById(lotId);
	if (!lot) {
		return { success: false as const, error: 'Lote no encontrado' };
	}
	if (!lot.productId) {
		return { success: false as const, error: 'Solo se pueden ajustar lotes de productos' };
	}

	const isOutflow = adjustmentType === InventoryMovementType.ADJUSTMENT_OUT;
	const quantityDelta = isOutflow ? -quantity : quantity;

	// For ADJUSTMENT_OUT: check available stock
	if (isOutflow && quantity > lot.quantityAvailable) {
		return {
			success: false as const,
			error: `Stock insuficiente. Disponible: ${lot.quantityAvailable}, solicitado: ${quantity}`
		};
	}

	const quantityBefore = lot.quantityAvailable;
	const quantityAfter = quantityBefore + quantityDelta;

	// Cost tracking for ADJUSTMENT_OUT (real loss)
	const isCustomerReturn = reason === AdjustmentReason.CUSTOMER_RETURN;
	const unitCostAtAdjustment = isOutflow && !isCustomerReturn ? lot.unitPurchasePrice : null;
	const totalCostAtAdjustment =
		unitCostAtAdjustment != null ? unitCostAtAdjustment * quantity : null;
	const adjustmentReportCategory = isOutflow
		? ADJUSTMENT_REPORT_CATEGORIES[reason]
		: isCustomerReturn
			? ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.CUSTOMER_RETURN]
			: null;

	const formattedNotes = `${reason}: ${notes}`;

	try {
		const result = await db.transaction(async (tx) => {
			// 1. Update lot quantity
			await tx
				.update(inventoryLots)
				.set({
					quantityAvailable: quantityAfter,
					isActive: quantityAfter > 0,
					updatedAt: nowISO()
				})
				.where(eq(inventoryLots.id, lotId));

			// 2. Create immutable movement record
			const movement = await createInventoryMovement(
				{
					movementType: adjustmentType,
					lotId,
					itemType: lot.itemType,
					productId: lot.productId,
					lensCatalogItemId: lot.lensCatalogItemId,
					quantityDelta,
					quantityBefore,
					quantityAfter,
					referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
					referenceId: lotId,
					notes: formattedNotes,
					unitCostAtAdjustment,
					totalCostAtAdjustment,
					adjustmentReportCategory,
					createdById: user.id
				},
				tx
			);

			// 3. Update cached stock on product
			await tx
				.update(products)
				.set({
					stock: sql`${products.stock} + ${quantityDelta}`,
					updatedAt: nowISO()
				})
				.where(eq(products.id, lot.productId!));

			return { movement, newStock: quantityAfter };
		});

		return {
			success: true as const,
			lotId,
			productId: lot.productId,
			newQuantityAvailable: result.newStock,
			movementId: result.movement.id
		};
	} catch (e) {
		console.error('Error creating manual adjustment:', e);
		return { success: false as const, error: getErrorMessage(e) };
	}
});

export const revertFullLotCmd = command(RevertLotSchema, async (data) => {
	const user = requireRole(UserRole.SUPERADMIN, UserRole.ADMIN);

	const lot = await findLotById(data.lotId);
	if (!lot) {
		return { success: false as const, error: 'Lote no encontrado' };
	}

	// Can only revert if NO units have been consumed (sold, adjusted out, etc.)
	if (lot.quantityAvailable !== lot.quantityInitial) {
		return {
			success: false as const,
			error: `No se puede revertir: el lote tiene ${lot.quantityInitial - lot.quantityAvailable} unidades ya consumidas`
		};
	}

	const quantityDelta = -lot.quantityInitial;

	try {
		await db.transaction(async (tx) => {
			// 1. Zero out the lot
			await tx
				.update(inventoryLots)
				.set({
					quantityAvailable: 0,
					isActive: false,
					updatedAt: nowISO()
				})
				.where(eq(inventoryLots.id, data.lotId));

			// 2. Create ADJUSTMENT_OUT movement with ENTRY_ERROR reason
			await createInventoryMovement(
				{
					movementType: InventoryMovementType.ADJUSTMENT_OUT,
					lotId: data.lotId,
					itemType: lot.itemType,
					productId: lot.productId,
					lensCatalogItemId: lot.lensCatalogItemId,
					quantityDelta,
					quantityBefore: lot.quantityAvailable,
					quantityAfter: 0,
					referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
					referenceId: data.lotId,
					notes: 'ENTRY_ERROR: Reversión completa de lote',
					createdById: user.id
				},
				tx
			);

			// 3. Update cached stock on product
			if (lot.productId) {
				await tx
					.update(products)
					.set({
						stock: sql`${products.stock} + ${quantityDelta}`,
						updatedAt: nowISO()
					})
					.where(eq(products.id, lot.productId));
			}
		});

		return { success: true as const, lotId: data.lotId };
	} catch (e) {
		console.error('Error reverting lot:', e);
		return { success: false as const, error: getErrorMessage(e) };
	}
});
