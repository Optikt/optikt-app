/**
 * Sales remote — cancel lifecycle
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/cancelSale.ts.
 */
import { command } from '$app/server';
import { requireRole } from '#lib/server/guards.js';
import { CancelSaleSchema } from '#lib/schemas//index.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getActionContext } from '#lib/server/actionContext.js';
import { cancelSaleCore } from '#lib/server/sales/cancelSale.js';

export const cancelSale = command(CancelSaleSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return cancelSaleCore(data, getActionContext(user));
});
