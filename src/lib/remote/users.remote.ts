/**
 * Users Remote Functions
 * CRUD operations for user management
 */
import { error } from '@sveltejs/kit';
import { command } from '$app/server';
import { hash } from '@node-rs/argon2';
import { getCurrentUser, requireAdmin } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	findUserByEmail,
	findUserByUsername,
	findUserById,
	updateUser as dbUpdateUser,
	deleteUser as dbDeleteUser
} from '$lib/server/db/queries/users';
import { eq, or, ilike, and, isNull, count, desc } from 'drizzle-orm';

// Import schemas
import {
	ListUsersSchema,
	CreateUserSchema,
	UpdateUserSchema,
	UserIdSchema
} from '$lib/schemas/users';

import type { UserListItem, PaginatedUsers } from '$lib/types/users';

/**
 * List users with pagination, search, and filtering
 */
export const listUsers = command(ListUsersSchema, async (input): Promise<PaginatedUsers> => {
	requireAdmin();

	const { page, perPage, search, role, includeInactive } = input;
	const offset = (page - 1) * perPage;

	// Build where conditions
	const conditions = [];

	// Exclude soft-deleted users
	conditions.push(isNull(users.deletedAt));

	// Filter by active status
	if (!includeInactive) {
		conditions.push(eq(users.isActive, true));
	}

	// Filter by role
	if (role) {
		conditions.push(eq(users.role, role));
	}

	// Search by email, username, or fullName
	if (search && search.trim()) {
		const searchPattern = `%${search.trim()}%`;
		conditions.push(
			or(
				ilike(users.email, searchPattern),
				ilike(users.username, searchPattern),
				ilike(users.fullName, searchPattern)
			)
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [countResult] = await db.select({ count: count() }).from(users).where(whereClause);

	const total = countResult?.count ?? 0;

	// Get paginated users
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
		.where(whereClause)
		.orderBy(desc(users.createdAt))
		.limit(perPage)
		.offset(offset);

	return {
		users: userList as UserListItem[],
		total,
		page,
		perPage,
		totalPages: Math.ceil(total / perPage)
	};
});

/**
 * Create a new user
 */
export const createUser = command(CreateUserSchema, async (input): Promise<UserListItem> => {
	requireAdmin();

	const { email, username, password, fullName, role, isActive } = input;

	// Check for existing email
	const existingEmail = await findUserByEmail(email);
	if (existingEmail) {
		error(400, 'El email ya está registrado');
	}

	// Check for existing username
	const existingUsername = await findUserByUsername(username);
	if (existingUsername) {
		error(400, 'El nombre de usuario ya está en uso');
	}

	// Hash the password
	const hashedPassword = await hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	// Create the user
	const now = new Date();
	const [newUser] = await db
		.insert(users)
		.values({
			id: crypto.randomUUID(),
			email: email.toLowerCase(),
			username: username.toLowerCase(),
			fullName,
			hashedPassword,
			role: role ?? UserRole.VIEWER,
			isActive: isActive ?? true,
			isSuperuser: false,
			createdAt: now,
			updatedAt: now
		})
		.returning({
			id: users.id,
			email: users.email,
			username: users.username,
			fullName: users.fullName,
			role: users.role,
			isActive: users.isActive,
			isSuperuser: users.isSuperuser,
			createdAt: users.createdAt
		});

	return newUser as UserListItem;
});

/**
 * Update an existing user
 */
export const updateUser = command(UpdateUserSchema, async (input): Promise<UserListItem> => {
	requireAdmin();

	const { id, email, username, password, ...rest } = input;

	// Check if user exists
	const existingUser = await findUserById(id);
	if (!existingUser) {
		error(404, 'Usuario no encontrado');
	}

	// Check for email uniqueness if changing
	if (email && email.toLowerCase() !== existingUser.email) {
		const emailExists = await findUserByEmail(email);
		if (emailExists) {
			error(400, 'El email ya está registrado');
		}
	}

	// Check for username uniqueness if changing
	if (username && username.toLowerCase() !== existingUser.username) {
		const usernameExists = await findUserByUsername(username);
		if (usernameExists) {
			error(400, 'El nombre de usuario ya está en uso');
		}
	}

	// Prepare update data
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const updateData: Record<string, any> = { ...rest };

	if (email) {
		updateData.email = email.toLowerCase();
	}

	if (username) {
		updateData.username = username.toLowerCase();
	}

	if (password) {
		updateData.hashedPassword = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
	}

	return await dbUpdateUser(id, updateData);
});

/**
 * Toggle user active status
 */
export const toggleUserActive = command(UserIdSchema, async (input): Promise<UserListItem> => {
	requireAdmin();

	const user = await findUserById(input.id);
	if (!user) {
		error(404, 'Usuario no encontrado');
	}

	// Prevent deactivating oneself
	const currentUser = getCurrentUser();
	if (currentUser && currentUser.id === user.id) {
		error(400, 'No puedes desactivar tu propia cuenta');
	}

	const [updatedUser] = await db
		.update(users)
		.set({ isActive: !user.isActive, updatedAt: new Date() })
		.where(eq(users.id, input.id))
		.returning({
			id: users.id,
			email: users.email,
			username: users.username,
			fullName: users.fullName,
			role: users.role,
			isActive: users.isActive,
			isSuperuser: users.isSuperuser,
			createdAt: users.createdAt
		});

	return updatedUser as UserListItem;
});

/**
 * Delete a user (soft delete)
 */
export const deleteUserById = command(
	UserIdSchema,
	async (input): Promise<{ success: boolean }> => {
		requireAdmin();

		const user = await findUserById(input.id);
		if (!user) {
			error(404, 'Usuario no encontrado');
		}

		// Prevent deleting superusers
		if (user.isSuperuser) {
			error(400, 'No se puede eliminar un superadministrador');
		}

		const deleted = await dbDeleteUser(input.id);

		return { success: deleted };
	}
);
