import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { isNull, desc, count } from 'drizzle-orm';

/**
 * Load initial users data for SSR
 * Only handles initial page load - all interactions use remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	// Get initial users (first page, active only)
	const [countResult] = await db
		.select({ count: count() })
		.from(users)
		.where(isNull(users.deletedAt));

	const userList = await db
		.select({
			id: users.id,
			email: users.email,
			username: users.username,
			fullName: users.fullName,
			role: users.role,
			isActive: users.isActive,
			isSuperuser: users.isSuperuser,
			createdAt: users.createdAt
		})
		.from(users)
		.where(isNull(users.deletedAt))
		.orderBy(desc(users.createdAt))
		.limit(10);

	return {
		initialUsers: userList,
		totalCount: countResult?.count ?? 0
	};
};
