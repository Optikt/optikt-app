import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { listTrash, trashLabel } from '#lib/server/db/queries/deletedItems.js';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

	const items = await listTrash();
	return {
		items: items.map((item) => ({ ...item, label: trashLabel(item) }))
	};
};
