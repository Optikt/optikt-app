import type { PageServerLoad } from './$types';
import { getInventoryReport } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const items = await getInventoryReport();
	return { items };
};
