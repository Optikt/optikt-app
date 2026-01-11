/**
 * Settings Remote Functions
 * Handles business settings get/update (admin only for updates)
 */
import { query, form } from '$app/server';
import { UpdateSettingsSchema } from '$lib/schemas/settings';
import {
	getSettings as getSettingsQuery,
	updateSettings as updateSettingsQuery
} from '$lib/server/db/queries';
import type { Settings } from '$lib/server/db/schema';
import * as v from 'valibot';

// Empty schema for getting settings (no params needed)
const EmptySchema = v.object({});

/**
 * Get business settings
 */
export const getSettings = query(EmptySchema, async (): Promise<Settings | null> => {
	const settings = await getSettingsQuery();
	return settings;
});

/**
 * Update business settings (to be protected by page-level auth check)
 */
export const updateSettingsForm = form(UpdateSettingsSchema, async (data): Promise<Settings> => {
	// Validation is done by schema, just update
	const updated = await updateSettingsQuery({
		businessName: data.businessName || undefined,
		businessRif: data.businessRif || undefined,
		businessPhone: data.businessPhone || undefined,
		businessEmail: data.businessEmail || undefined,
		businessAddress: data.businessAddress || undefined,
		businessWebsite: data.businessWebsite || undefined,
		businessLogo: data.businessLogo || undefined
	});

	return updated;
});
