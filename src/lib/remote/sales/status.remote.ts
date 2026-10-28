/**
 * Sales remote — status transitions
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/setSaleStatus.ts.
 */
import { query, command } from '$app/server';
import { requireAuth } from '#lib/server/guards.js';
import { SetSaleStatusSchema } from '#lib/schemas/sales.js';
import { getNextOrderNumber } from '#lib/server/db/queries/sales/reads.js';
import { getActionContext } from '#lib/server/actionContext.js';
import { setSaleStatusCore } from '#lib/server/sales/setSaleStatus.js';
import { EmptySchema } from '#lib/schemas/common/dates.js';

/**
 * Set the sale status (manual transition, forward or backward).
 * - Forward transitions (toward COMPLETED): any user that can manage the sale.
 * - Backward transitions (reverting): ADMIN/MANAGER only.
 * - completedAt is set when entering COMPLETED and cleared when leaving it.
 */
export const setSaleStatus = command(SetSaleStatusSchema, async (data) => {
	const user = requireAuth();
	return setSaleStatusCore(data, getActionContext(user));
});

/**
 * Get the next suggested order number (MAX + 1).
 * Used to reset the create-sale form suggestion after a manual override.
 */
export const getNextOrderNumberCommand = query(EmptySchema, async (): Promise<number> => {
	requireAuth();
	return getNextOrderNumber();
});
