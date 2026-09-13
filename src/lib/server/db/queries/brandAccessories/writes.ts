import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { nowISO } from '$lib/dates';
import { db } from '$lib/server/db';
import {
	brandAccessories,
	type BrandAccessory,
	type NewBrandAccessory
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
import {
	assertAccessoryProduct,
	assertProductOverrideTarget,
	findExistingRule,
	normalizePriceConfig,
	reactivateProductOverrideRows
} from './internal';
import type { UpsertBrandAccessoryData } from './types';

export async function upsertBrandAccessory(
	data: UpsertBrandAccessoryData,
	executor: DbOrTx = db
): Promise<BrandAccessory> {
	await assertAccessoryProduct(data.accessoryProductId, executor);
	if (data.productId) {
		await assertProductOverrideTarget(data.productId, data.brandId, executor);
		await reactivateProductOverrideRows(data.productId, data.brandId, executor);
	}

	const now = nowISO();
	const priceConfig = normalizePriceConfig(data);
	const nextValues: Partial<NewBrandAccessory> = {
		brandId: data.brandId,
		productId: data.productId ?? null,
		accessoryProductId: data.accessoryProductId,
		priceMode: priceConfig.priceMode,
		customPrice: priceConfig.customPrice,
		isActive: data.isActive ?? true,
		updatedAt: now
	};

	const existing = data.id
		? ((
				await executor.select().from(brandAccessories).where(eq(brandAccessories.id, data.id))
			)?.[0] ?? null)
		: await findExistingRule(data, executor);

	if (existing) {
		const [updated] = await executor
			.update(brandAccessories)
			.set(nextValues)
			.where(eq(brandAccessories.id, existing.id))
			.returning();

		return updated;
	}

	const [created] = await executor
		.insert(brandAccessories)
		.values({
			brandId: data.brandId,
			productId: data.productId ?? null,
			accessoryProductId: data.accessoryProductId,
			priceMode: priceConfig.priceMode,
			customPrice: priceConfig.customPrice,
			isActive: data.isActive ?? true,
			createdById: data.createdById,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return created;
}

export async function deleteBrandAccessory(id: number, executor: DbOrTx = db): Promise<void> {
	await executor.delete(brandAccessories).where(eq(brandAccessories.id, id));
}

export async function toggleProductOverride(
	productId: string,
	brandId: string,
	isActive: boolean,
	createdById: string,
	executor: DbOrTx = db
): Promise<void> {
	await assertProductOverrideTarget(productId, brandId, executor);

	const now = nowISO();
	const existingRows = await executor
		.select()
		.from(brandAccessories)
		.where(and(eq(brandAccessories.brandId, brandId), eq(brandAccessories.productId, productId)));

	const accessoryRows = existingRows.filter((row) => row.accessoryProductId !== null);
	const markerRows = existingRows.filter((row) => row.accessoryProductId === null);

	if (isActive) {
		if (markerRows.length > 0) {
			await executor
				.delete(brandAccessories)
				.where(
					and(
						eq(brandAccessories.brandId, brandId),
						eq(brandAccessories.productId, productId),
						isNull(brandAccessories.accessoryProductId)
					)
				);
		}

		if (accessoryRows.length > 0) {
			await executor
				.update(brandAccessories)
				.set({ isActive: true, updatedAt: now })
				.where(
					and(
						eq(brandAccessories.brandId, brandId),
						eq(brandAccessories.productId, productId),
						isNotNull(brandAccessories.accessoryProductId)
					)
				);
		}

		return;
	}

	if (accessoryRows.length > 0) {
		await executor
			.update(brandAccessories)
			.set({ isActive: false, updatedAt: now })
			.where(
				and(
					eq(brandAccessories.brandId, brandId),
					eq(brandAccessories.productId, productId),
					isNotNull(brandAccessories.accessoryProductId)
				)
			);

		if (markerRows.length > 0) {
			await executor
				.delete(brandAccessories)
				.where(
					and(
						eq(brandAccessories.brandId, brandId),
						eq(brandAccessories.productId, productId),
						isNull(brandAccessories.accessoryProductId)
					)
				);
		}

		return;
	}

	if (markerRows.length > 0) {
		await executor
			.update(brandAccessories)
			.set({ isActive: false, updatedAt: now })
			.where(
				and(
					eq(brandAccessories.brandId, brandId),
					eq(brandAccessories.productId, productId),
					isNull(brandAccessories.accessoryProductId)
				)
			);
		return;
	}

	await executor.insert(brandAccessories).values({
		brandId,
		productId,
		accessoryProductId: null,
		priceMode: BrandAccessoryPriceMode.COURTESY,
		customPrice: null,
		isActive: false,
		createdById,
		createdAt: now,
		updatedAt: now
	});
}
