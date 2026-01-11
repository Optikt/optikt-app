/**
 * Settings Database Queries
 * Handles business configuration settings (singleton row)
 */
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { settings, type Settings } from '$lib/server/db/schema';

/**
 * Get business settings (always returns the first/only row)
 */
export async function getSettings(): Promise<Settings | null> {
	const [result] = await db.select().from(settings).limit(1);
	return result ?? null;
}

/**
 * Update business settings
 * Creates the row if it doesn't exist, otherwise updates
 */
export async function updateSettings(
	data: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Settings> {
	const existing = await getSettings();

	if (existing) {
		const [updated] = await db
			.update(settings)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(settings.id, existing.id))
			.returning();
		return updated;
	} else {
		// Create new settings row
		const [created] = await db
			.insert(settings)
			.values({
				...data
			})
			.returning();
		return created;
	}
}
