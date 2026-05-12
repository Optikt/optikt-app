import { command, query } from '$app/server';

import { db } from '$lib/server/db';
import {
	deleteBrandAccessory as deleteBrandAccessoryQuery,
	getAccessoriesForProduct as getAccessoriesForProductQuery,
	getBrandAccessories as getBrandAccessoriesQuery,
	getProductAccessoryOverride as getProductAccessoryOverrideQuery,
	toggleProductOverride as toggleProductOverrideQuery,
	upsertBrandAccessory as upsertBrandAccessoryQuery,
	type BrandAccessoryRuleRow,
	type ProductAccessoryOverride,
	type ResolvedAccessoryRule
} from '$lib/server/db/queries/brandAccessories';
import { requireAdmin, requireAuth } from '$lib/server/guards';
import {
	BrandAccessoriesByBrandSchema,
	BrandAccessoryIdSchema,
	GetAccessoriesForProductSchema,
	ProductAccessoryOverrideSchema,
	ToggleProductOverrideSchema,
	UpsertBrandAccessorySchema
} from '$lib/schemas/brandAccessories';

export const getAccessoriesForProduct = query(
	GetAccessoriesForProductSchema,
	async (data): Promise<ResolvedAccessoryRule[]> => {
		requireAuth();
		return getAccessoriesForProductQuery(data.productId, data.brandId);
	}
);

export const getBrandAccessories = query(
	BrandAccessoriesByBrandSchema,
	async (data): Promise<BrandAccessoryRuleRow[]> => {
		requireAdmin();
		return getBrandAccessoriesQuery(data.brandId);
	}
);

export const getProductAccessoryOverride = query(
	ProductAccessoryOverrideSchema,
	async (data): Promise<ProductAccessoryOverride | null> => {
		requireAdmin();
		return getProductAccessoryOverrideQuery(data.id);
	}
);

export const upsertBrandAccessory = command(UpsertBrandAccessorySchema, async (data) => {
	const user = requireAdmin();
	return db.transaction((tx) => upsertBrandAccessoryQuery({ ...data, createdById: user.id }, tx));
});

export const deleteBrandAccessory = command(BrandAccessoryIdSchema, async (data) => {
	requireAdmin();
	await db.transaction((tx) => deleteBrandAccessoryQuery(data.id, tx));
});

export const toggleProductOverride = command(ToggleProductOverrideSchema, async (data) => {
	const user = requireAdmin();
	await db.transaction((tx) =>
		toggleProductOverrideQuery(data.productId, data.brandId, data.isActive, user.id, tx)
	);
});
