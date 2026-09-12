/**
 * Users remote forms
 * Split from users.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { error, invalid } from '@sveltejs/kit';
import { form } from '$app/server';
import { hash } from '@node-rs/argon2';
import { requireUserAdmin } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	findUserByEmail,
	findUserByUsername,
	findUserById,
	findDeletedUserByEmail,
	findDeletedUserByUsername,
	updateUser as dbUpdateUser
} from '$lib/server/db/queries/users';

// Import schemas
import { CreateUserSchema, UpdateUserSchema } from '$lib/schemas/users';

import type { UserListItem, CreateUserResult } from '$lib/types/users';
import { nowISO } from '$lib/dates';
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

		const { email, username, password, fullName, role } = data;

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
					deactivatedAt: deletedUserByEmail.deactivatedAt,
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
				deactivatedAt: users.deactivatedAt,
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
