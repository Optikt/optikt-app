/**
 * Sales remote — item commands
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/.
 */
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { UpdateSaleItemCostsSchema, EnrichFreeItemSchema } from '$lib/schemas/';
import { getActionContext } from '$lib/server/actionContext';
import { updateItemCostsCore } from '$lib/server/sales/updateItemCosts';
import { enrichFreeItemCore } from '$lib/server/sales/enrichFreeItem';

export const updateItemCosts = command(UpdateSaleItemCostsSchema, async (data) => {
	const user = requireAdmin();
	return updateItemCostsCore(data, getActionContext(user));
});

export const enrichFreeItem = command(EnrichFreeItemSchema, async (data) => {
	const user = requireAdmin();
	return enrichFreeItemCore(data, getActionContext(user));
});
