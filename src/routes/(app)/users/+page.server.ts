import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema/index.js';
import { isNull, desc, count } from 'drizzle-orm';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';

/**
 * Load initial users data for SSR
 * Only handles initial page load - all interactions use remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

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
			deactivatedAt: users.deactivatedAt,
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
