/**
 * Settings Remote Functions
 * Handles business settings get/update (ADMIN only)
 */
import { query, form } from '$app/server';
import { requireUserAdmin } from '#lib/server/guards.js';
import { EmptySchema } from '#lib/schemas/common/dates.js';
import { UpdateSettingsSchema } from '#lib/schemas/settings.js';
import {
	getSettings as getSettingsQuery,
	updateSettings as updateSettingsQuery
} from '#lib/server/db/queries/index.js';
import type { Settings } from '#lib/server/db/schema/index.js';

// Empty schema for getting settings (no params needed)

/**
 * Get business settings
 */
export const getSettings = query(EmptySchema, async (): Promise<Settings> => {
	requireUserAdmin();

	return getSettingsQuery();
});

/**
 * Update business settings (ADMIN only)
 */
export const updateSettingsForm = form(UpdateSettingsSchema, async (data): Promise<Settings> => {
	requireUserAdmin();

	// Validation is done by schema, just update
	const updated = await updateSettingsQuery({
		businessName: data.businessName || undefined,
		businessRif: data.businessRif || undefined,
		businessPhone: data.businessPhone || undefined,
		businessEmail: data.businessEmail || undefined,
		businessAddress: data.businessAddress || undefined,
		businessWebsite: data.businessWebsite || undefined,
		businessLogo: data.businessLogo || undefined,
		defaultTaxRate: data.defaultTaxRate
	});

	return updated;
});
