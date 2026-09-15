/**
 * Inventory Remote Functions
 * Shell: auth + delegate + movement history query.
 * Logic lives in src/lib/server/inventory/*.
 */
import { command, query } from '$app/server';
import {
	ManualAdjustmentSchema,
	ListInventoryMovementsSchema,
	RevertLotSchema
} from '$lib/schemas/inventory';
import { requireAuth, requireRole } from '$lib/server/guards';
import {
	getMovementsWithDetails,
	countInventoryMovements
} from '$lib/server/db/queries/inventoryMovements';
import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
import { UserRole } from '$lib/shared/enums';
import type { PaginatedResult } from '$lib/types';
import { getActionContext } from '$lib/server/actionContext';
import { createManualAdjustmentCore } from '$lib/server/inventory/createManualAdjustment';
import { revertFullLotCore } from '$lib/server/inventory/revertFullLot';

// ============================================================================
// QUERIES
// ============================================================================

export const listInventoryMovements = query(
	ListInventoryMovementsSchema,
	async (data): Promise<PaginatedResult<MovementWithDetails>> => {
		requireAuth();

		const { page, perPage } = data;
		const filterOptions = {
			lotId: data.lotId ?? undefined,
			productId: data.productId ?? undefined,
			lensCatalogItemId: data.lensCatalogItemId ?? undefined,
			movementType: data.movementType ?? undefined,
			referenceType: data.referenceType ?? undefined,
			search: data.search ?? undefined,
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
	// Only ADMIN can create manual adjustments
	const user = requireRole(UserRole.ADMIN);
	return createManualAdjustmentCore(data, getActionContext(user));
});

export const revertFullLotCmd = command(RevertLotSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN);
	return revertFullLotCore(data, getActionContext(user));
});
