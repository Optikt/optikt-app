import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { listTrash, trashLabel } from '$lib/server/db/queries/deletedItems';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

	const items = await listTrash();
	return {
		items: items.map((item) => ({ ...item, label: trashLabel(item) }))
	};
};
