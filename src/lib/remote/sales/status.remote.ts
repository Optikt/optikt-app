/**
 * Sales remote — status transitions
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/setSaleStatus.ts.
 */
import { query, command } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { SetSaleStatusSchema } from '$lib/schemas/sales';
import { getSaleOrderNumberPreview } from '$lib/server/db/queries/sales/reads';
import { getActionContext } from '$lib/server/actionContext';
import { setSaleStatusCore } from '$lib/server/sales/setSaleStatus';
import { EmptySchema } from '$lib/schemas/common/dates';

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
 * Non-reserving preview of the next automatic order number (reads the sales
 * sequence, never consumes it). Used to reset the create-sale form suggestion
 * after a manual override and by the quote conversion modal.
 */
export const getNextOrderNumberCommand = query(EmptySchema, async (): Promise<number> => {
	requireAuth();
	return getSaleOrderNumberPreview();
});
