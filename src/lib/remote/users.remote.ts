/**
 * Users Remote Functions
 * CRUD operations for user management
 */
import { error, invalid } from '@sveltejs/kit';
import { command, form } from '$app/server';
import { hash } from '@node-rs/argon2';
import { getCurrentUser, requireUserAdmin } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	findUserByEmail,
	findUserByUsername,
	findUserById,
	findDeletedUserByEmail,
	findDeletedUserByUsername,
	updateUser as dbUpdateUser,
	deleteUser as dbDeleteUser,
	restoreUser as dbRestoreUser
} from '$lib/server/db/queries/users';
import { eq, or, ilike, and, isNull, count, desc } from 'drizzle-orm';

// Import schemas
import {
	ListUsersSchema,
	CreateUserSchema,
	UpdateUserSchema,
	UserIdSchema,
	ReactivateUserSchema
} from '$lib/schemas/users';

import type { UserListItem, PaginatedUsers, CreateUserResult } from '$lib/types/users';
import { nowISO } from '$lib/dates';

/**
 * List users with pagination, search, and filtering
 */
export const listUsers = command(ListUsersSchema, async (input): Promise<PaginatedUsers> => {
	requireUserAdmin();

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
 * Returns either a success with user, or a reactivation candidate for confirmation
 */
export const createUser = command(CreateUserSchema, async (input): Promise<CreateUserResult> => {
	requireUserAdmin();

	const { email, username, password, fullName, role, isActive } = input;

	// Check for existing ACTIVE email
	const existingActiveEmail = await findUserByEmail(email);
	if (existingActiveEmail) {
		error(400, 'El email ya está registrado');
	}

	// Check for existing ACTIVE username
	const existingActiveUsername = await findUserByUsername(username);
	if (existingActiveUsername) {
		error(400, 'El nombre de usuario ya está en uso');
	}

	// Check for DELETED user with same email (reactivation candidate)
	const deletedUserByEmail = await findDeletedUserByEmail(email);
	if (deletedUserByEmail) {
		// Check if the username is available OR belongs to this same deleted user
		const deletedUserByUsername = await findDeletedUserByUsername(username);

		if (deletedUserByUsername && deletedUserByUsername.id !== deletedUserByEmail.id) {
			// Username belongs to a DIFFERENT deleted user - not allowed
			error(400, 'El nombre de usuario está en uso por otro usuario eliminado');
		}

		// Can reactivate! Return candidate for confirmation
		return {
			success: false,
			reactivationCandidate: {
				id: deletedUserByEmail.id,
				email: deletedUserByEmail.email,
				username: deletedUserByEmail.username,
				fullName: deletedUserByEmail.fullName,
				role: deletedUserByEmail.role,
				isActive: deletedUserByEmail.isActive,
				isSuperuser: deletedUserByEmail.isSuperuser,
				createdAt: deletedUserByEmail.createdAt
			},
			message:
				'Este email pertenece a un usuario eliminado. ¿Desea reactivarlo con los nuevos datos?'
		};
	}

	// Check if username is used by a DELETED user (email is free)
	const deletedByUsername = await findDeletedUserByUsername(username);
	if (deletedByUsername) {
		error(400, 'El nombre de usuario está en uso. Por favor elija otro.');
	}

	// All clear - create new user
	const hashedPassword = await hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	const now = nowISO();
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

	return { success: true, user: newUser as UserListItem };
});

/**
 * Reactivate a deleted user with new data
 */
export const reactivateUser = command(
	ReactivateUserSchema,
	async (input): Promise<UserListItem> => {
		requireUserAdmin();

		const { deletedUserId, email, username, password, fullName, role, isActive } = input;

		// Verify the user exists and is deleted
		const deletedUser = await findUserById(deletedUserId);
		if (!deletedUser || !deletedUser.deletedAt) {
			error(404, 'Usuario eliminado no encontrado');
		}

		// Hash the new password
		const hashedPassword = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		// Restore the user with new data
		const restoredUser = await dbRestoreUser(deletedUserId, {
			email: email.toLowerCase(),
			username: username.toLowerCase(),
			fullName,
			hashedPassword,
			role: role ?? UserRole.VIEWER,
			isActive: isActive ?? true
		});

		return {
			id: restoredUser.id,
			email: restoredUser.email,
			username: restoredUser.username,
			fullName: restoredUser.fullName,
			role: restoredUser.role,
			isActive: restoredUser.isActive,
			isSuperuser: restoredUser.isSuperuser,
			createdAt: restoredUser.createdAt
		};
	}
);

/**
 * Update an existing user
 */
export const updateUser = command(UpdateUserSchema, async (input): Promise<UserListItem> => {
	requireUserAdmin();

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
	requireUserAdmin();

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
		.set({ isActive: !user.isActive, updatedAt: nowISO() })
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
		requireUserAdmin();

		const user = await findUserById(input.id);
		if (!user) {
			error(404, 'Usuario no encontrado');
		}

		// Prevent deleting superusers
		if (user.isSuperuser) {
			error(400, 'No se puede eliminar un administrador');
		}

		// Prevent deleting oneself
		const currentUser = getCurrentUser();
		if (currentUser && currentUser.id === user.id) {
			error(400, 'No puedes eliminar tu propia cuenta');
		}

		const deleted = await dbDeleteUser(input.id);

		return { success: deleted };
	}
);

// ============================================================================
// FORM REMOTE FUNCTIONS
// For form submissions with validation and field-level errors
// ============================================================================

/**
 * Create user form
 * Uses form() for proper form handling with field-level validation
 */
export const createUserForm = form(
	CreateUserSchema,
	async (data, issue): Promise<CreateUserResult> => {
		requireUserAdmin();

		const { email, username, password, fullName, role, isActive } = data;

		// Check for existing ACTIVE email
		const existingActiveEmail = await findUserByEmail(email);
		if (existingActiveEmail) {
			invalid(issue.email('Este email ya está registrado'));
		}

		// Check for existing ACTIVE username
		const existingActiveUsername = await findUserByUsername(username);
		if (existingActiveUsername) {
			invalid(issue.username('Este nombre de usuario ya está en uso'));
		}

		// Check for DELETED user with same email (reactivation candidate)
		const deletedUserByEmail = await findDeletedUserByEmail(email);
		if (deletedUserByEmail) {
			// Check if the username is available OR belongs to this same deleted user
			const deletedUserByUsername = await findDeletedUserByUsername(username);

			if (deletedUserByUsername && deletedUserByUsername.id !== deletedUserByEmail.id) {
				// Username belongs to a DIFFERENT deleted user - not allowed
				invalid(issue.username('Este nombre de usuario está en uso por otro usuario eliminado'));
			}

			// Can reactivate! Return candidate for confirmation
			return {
				success: false,
				reactivationCandidate: {
					id: deletedUserByEmail.id,
					email: deletedUserByEmail.email,
					username: deletedUserByEmail.username,
					fullName: deletedUserByEmail.fullName,
					role: deletedUserByEmail.role,
					isActive: deletedUserByEmail.isActive,
					isSuperuser: deletedUserByEmail.isSuperuser,
					createdAt: deletedUserByEmail.createdAt
				},
				message:
					'Este email pertenece a un usuario eliminado. ¿Desea reactivarlo con los nuevos datos?'
			};
		}

		// Check if username is used by a DELETED user (email is free)
		const deletedByUsername = await findDeletedUserByUsername(username);
		if (deletedByUsername) {
			invalid(issue.username('Este nombre de usuario está en uso. Por favor elija otro.'));
		}

		// All clear - create new user
		const hashedPassword = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		const now = nowISO();
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

		return { success: true, user: newUser as UserListItem };
	}
);

/**
 * Update user form
 * Uses form() for proper form handling with field-level validation
 */
export const updateUserForm = form(UpdateUserSchema, async (data, issue): Promise<UserListItem> => {
	requireUserAdmin();

	const { id, email, username, password, ...rest } = data;

	// Check if user exists
	const existingUser = await findUserById(id);
	if (!existingUser) {
		error(404, 'Usuario no encontrado');
	}

	// Check for email uniqueness if changing
	if (email && email.toLowerCase() !== existingUser.email) {
		const emailExists = await findUserByEmail(email);
		if (emailExists) {
			invalid(issue.email('Este email ya está registrado'));
		}
	}

	// Check for username uniqueness if changing
	if (username && username.toLowerCase() !== existingUser.username) {
		const usernameExists = await findUserByUsername(username);
		if (usernameExists) {
			invalid(issue.username('Este nombre de usuario ya está en uso'));
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
