/**
 * Escritura compartida de updateUser (command) y updateUserForm (form).
 * DT26: persiste solo el diff; si cambia la clave, corta las sesiones del
 * usuario objetivo en la misma transacción (conservando la actual si es la propia).
 */
import { hash } from '@node-rs/argon2';
import { getCurrentSession, getCurrentUser } from '$lib/server/guards';
import { db } from '$lib/server/db';
import type { User } from '$lib/server/db/schema';
import { updateUser as dbUpdateUser, toUserListItem } from '$lib/server/db/queries/users';
import { deactivateSessionsAfterPasswordChange } from '$lib/server/db/queries/sessions';
import { buildChangedFields, hasChangedFields } from '$lib/shared/buildChangedFields';

type UserUpdateInput = {
	email?: string;
	username?: string;
	password?: string;
	[key: string]: unknown;
};

export async function applyUserUpdate(existingUser: User, input: UserUpdateInput) {
	const { email, username, password, ...rest } = input;

	const changes: Partial<User> = buildChangedFields(existingUser, {
		...rest,
		email: email?.toLowerCase(),
		username: username?.toLowerCase()
	});

	if (password) {
		changes.hashedPassword = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
	}

	if (!hasChangedFields(changes)) {
		return toUserListItem(existingUser);
	}

	// Un admin que cambia su propia clave conserva la sesión actual (como el flujo de perfil)
	const id = existingUser.id;
	const keepSessionId = getCurrentUser()?.id === id ? getCurrentSession()?.id : undefined;
	const updated = await db.transaction(async (tx) => {
		const row = await dbUpdateUser(id, changes, tx);
		if (password) {
			await deactivateSessionsAfterPasswordChange(id, keepSessionId, tx);
		}
		return row;
	});
	return toUserListItem(updated);
}
