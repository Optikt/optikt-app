/**
 * Sales remote — per-person grouping (groups-only save).
 * Shell: auth + delegate. Logic lives in src/lib/server/sales/saveSaleItemGroups.ts.
 */
import { command } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { SaveSaleItemGroupsSchema } from '$lib/schemas/sales';
import { getActionContext } from '$lib/server/actionContext';
import { saveSaleItemGroupsCore } from '$lib/server/sales/saveSaleItemGroups';

export const saveSaleItemGroups = command(SaveSaleItemGroupsSchema, async (data) => {
	const user = requireAuth();
	return saveSaleItemGroupsCore(data, getActionContext(user));
});
