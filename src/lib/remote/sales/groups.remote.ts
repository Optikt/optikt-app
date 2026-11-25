/**
 * Sales remote — per-person grouping (groups-only save).
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/saveSaleItemGroups.ts.
 */
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums/roles';
import { SaveSaleItemGroupsSchema } from '$lib/schemas/sales';
import { getActionContext } from '$lib/server/actionContext';
import { saveSaleItemGroupsCore } from '$lib/server/sales/saveSaleItemGroups';

export const saveSaleItemGroups = command(SaveSaleItemGroupsSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return saveSaleItemGroupsCore(data, getActionContext(user));
});
