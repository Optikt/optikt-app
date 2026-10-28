/**
 * Sales remote — update command
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/updateSale.ts.
 */
import { command } from '$app/server';
import { requireAuth } from '#lib/server/guards.js';
import { UpdateSaleSchema } from '#lib/schemas/sales.js';
import { getActionContext } from '#lib/server/actionContext.js';
import { updateSaleCore } from '#lib/server/sales/updateSale.js';

export const updateSale = command(UpdateSaleSchema, async (data) => {
	const user = requireAuth();
	return updateSaleCore(data, getActionContext(user));
});
