/**
 * Profile Remote Functions
 * Handles user profile updates and password changes (own profile only)
 */
import { form } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { hash, verify } from '@node-rs/argon2';
import { UpdateProfileSchema, ChangePasswordSchema } from '$lib/schemas/settings';
import { updateUser, findUserByEmail, findUserById } from '$lib/server/db/queries';
import { requireAuth } from '$lib/server/guards';
import type { User } from '$lib/server/db/schema';

/**
 * Update own profile (fullName/email)
 */
export const updateProfileForm = form(UpdateProfileSchema, async (data, issue): Promise<User> => {
	const currentUser = requireAuth();

	// Check if email is already taken by another user
	if (data.email !== currentUser.email) {
		const existingUser = await findUserByEmail(data.email);
		if (existingUser && existingUser.id !== currentUser.id) {
			invalid(issue.email('El email ya está en uso por otro usuario'));
		}
	}

	const updated = await updateUser(currentUser.id, {
		fullName: data.fullName,
		email: data.email
	});

	return updated;
});

/**
 * Change own password
 */
export const changePasswordForm = form(
	ChangePasswordSchema,
	async (data, issue): Promise<{ success: boolean }> => {
		const currentUser = requireAuth();

		// Validate passwords match
		if (data.newPassword !== data.confirmPassword) {
			invalid(issue.confirmPassword('Las contraseñas no coinciden'));
		}

		// Get user with password hash
		const user = await findUserById(currentUser.id);
		if (!user || !user.hashedPassword) {
			invalid('Error al verificar usuario');
			throw new Error('Error al verificar usuario');
		}

		// Verify current password
		const isValid = await verify(user.hashedPassword, data.currentPassword);
		if (!isValid) {
			invalid(issue.currentPassword('La contraseña actual es incorrecta'));
		}

		// Hash and update new password
		const newHash = await hash(data.newPassword);
		await updateUser(currentUser.id, {
			hashedPassword: newHash
		});

		return { success: true };
	}
);
