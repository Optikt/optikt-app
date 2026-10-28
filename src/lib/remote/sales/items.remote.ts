/**
 * Sales remote — item commands
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/.
 */
import { command } from '$app/server';
import { requireAdmin } from '#lib/server/guards.js';
import { UpdateSaleItemCostsSchema, EnrichFreeItemSchema } from '#lib/schemas//index.js';
import { getActionContext } from '#lib/server/actionContext.js';
import { updateItemCostsCore } from '#lib/server/sales/updateItemCosts.js';
import { enrichFreeItemCore } from '#lib/server/sales/enrichFreeItem.js';

export const updateItemCosts = command(UpdateSaleItemCostsSchema, async (data) => {
	const user = requireAdmin();
	return updateItemCostsCore(data, getActionContext(user));
});

export const enrichFreeItem = command(EnrichFreeItemSchema, async (data) => {
	const user = requireAdmin();
	return enrichFreeItemCore(data, getActionContext(user));
});
