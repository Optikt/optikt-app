/**
 * Sales remote — create command
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/createSale.ts.
 */
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { CreateSaleSchema } from '$lib/schemas/sales';
import { UserRole } from '$lib/shared/enums';
import { getActionContext } from '$lib/server/actionContext';
import { createSaleCore } from '$lib/server/sales/createSale';

/**
 * Create a new sale with items in a single transaction.
 * Persists items with prescriptions and decrements product stock.
 */
export const createSale = command(CreateSaleSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return createSaleCore(data, getActionContext(user));
});
