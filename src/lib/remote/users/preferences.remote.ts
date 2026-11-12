/**
 * Users remote — preferencias de usuario (clave/valor).
 *
 * Dominio: `users`. La LECTURA en SSR no pasa por acá: el `+page.server.ts`
 * llama directo a la query function `getUserPreference` (ver `docs/agents/users.md`).
 */
import { command } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { UserPreferenceSchema } from '$lib/schemas/users';
import { setUserPreference } from '$lib/server/db/queries/userPreferences';

/**
 * Guarda una preferencia del usuario autenticado (upsert).
 * Es una preferencia personal, no una acción de negocio: la puede guardar
 * cualquier rol autenticado (VIEWER incluido).
 */
export const saveUserPreference = command(UserPreferenceSchema, async (data) => {
	const user = requireAuth();

	await setUserPreference(user.id, data.key, data.value);

	return { success: true as const };
});
