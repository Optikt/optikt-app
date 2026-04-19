/**
 * Settings Database Queries
 * Handles business configuration settings (singleton row)
 */
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { settings, type Settings } from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';

/**
 * Get business settings (always returns the first/only row)
 * Creates a default empty row if none exists.
 */
export async function getSettings(): Promise<Settings> {
	const [result] = await db.select().from(settings).limit(1);
	if (result) return result;

	// Auto-create the singleton row on first access
	const [created] = await db.insert(settings).values({}).returning();
	return created;
}

/**
 * Update business settings
 * The singleton row is guaranteed to exist via getSettings().
 */
export async function updateSettings(
	data: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Settings> {
	const existing = await getSettings();

	const [updated] = await db
		.update(settings)
		.set({
			...data,
			updatedAt: nowISO()
		})
		.where(eq(settings.id, existing.id))
		.returning();
	return updated;
}
