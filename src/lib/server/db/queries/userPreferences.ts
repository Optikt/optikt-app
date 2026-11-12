/**
 * Preferencias de usuario (clave/valor) — lectura y escritura.
 * Dominio: `users` (ver `docs/agents/users.md`).
 */
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userPreferences, type UserPreferenceValue } from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';
import type { DbOrTx } from '$lib/server/db/types';

/** Valor guardado para `userId` + `key`, o null si no existe. */
export async function getUserPreference(
	userId: string,
	key: string,
	executor: DbOrTx = db
): Promise<UserPreferenceValue | null> {
	const [row] = await executor
		.select({ value: userPreferences.value })
		.from(userPreferences)
		.where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
		.limit(1);

	return row?.value ?? null;
}

/** Upsert de una preferencia (idempotente). */
export async function setUserPreference(
	userId: string,
	key: string,
	value: UserPreferenceValue,
	executor: DbOrTx = db
): Promise<void> {
	const now = nowISO();
	await executor
		.insert(userPreferences)
		.values({ userId, key, value, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: [userPreferences.userId, userPreferences.key],
			set: { value, updatedAt: now }
		});
}
