/**
 * Sales remote — cancel lifecycle
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/cancelSale.ts.
 */
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { CancelSaleSchema } from '$lib/schemas/';
import { UserRole } from '$lib/shared/enums';
import { getActionContext } from '$lib/server/actionContext';
import { cancelSaleCore } from '$lib/server/sales/cancelSale';

export const cancelSale = command(CancelSaleSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return cancelSaleCore(data, getActionContext(user));
});
