import { and, asc, eq, isNull } from 'drizzle-orm';

import { nowISO } from '$lib/dates';
import { db } from '$lib/server/db';
import { brandSuppliers, brands, suppliers } from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';

export interface NamedRelationOption {
	id: string;
	name: string;
}

export interface BrandSupplierMaps {
	brandSupplierMap: Record<string, string[]>;
	supplierBrandMap: Record<string, string[]>;
}

export async function upsertBrandSupplierLink(
	brandId: string,
	supplierId: string,
	executor: DbOrTx = db
): Promise<void> {
	const now = nowISO();

	await executor
		.insert(brandSuppliers)
		.values({
			brandId,
			supplierId,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [brandSuppliers.brandId, brandSuppliers.supplierId],
			set: {
				updatedAt: now
			}
		});
}

export async function getBrandSupplierMaps(executor: DbOrTx = db): Promise<BrandSupplierMaps> {
	const rows = await executor
		.select({
			brandId: brandSuppliers.brandId,
			supplierId: brandSuppliers.supplierId
		})
		.from(brandSuppliers)
		.innerJoin(brands, eq(brandSuppliers.brandId, brands.id))
		.innerJoin(suppliers, eq(brandSuppliers.supplierId, suppliers.id))
		.where(and(isNull(brands.deletedAt), isNull(suppliers.deletedAt)));

	const brandSupplierMap: Record<string, string[]> = {};
	const supplierBrandMap: Record<string, string[]> = {};

	for (const row of rows) {
		brandSupplierMap[row.brandId] ??= [];
		brandSupplierMap[row.brandId].push(row.supplierId);

		supplierBrandMap[row.supplierId] ??= [];
		supplierBrandMap[row.supplierId].push(row.brandId);
	}

	return {
		brandSupplierMap,
		supplierBrandMap
	};
}

export async function getSupplierIdsByBrand(
	brandId: string,
	executor: DbOrTx = db
): Promise<string[]> {
	const rows = await executor
		.select({ supplierId: brandSuppliers.supplierId })
		.from(brandSuppliers)
		.innerJoin(suppliers, eq(brandSuppliers.supplierId, suppliers.id))
		.where(and(eq(brandSuppliers.brandId, brandId), isNull(suppliers.deletedAt)));

	return rows.map((row) => row.supplierId);
}

export async function getBrandIdsBySupplier(
	supplierId: string,
	executor: DbOrTx = db
): Promise<string[]> {
	const rows = await executor
		.select({ brandId: brandSuppliers.brandId })
		.from(brandSuppliers)
		.innerJoin(brands, eq(brandSuppliers.brandId, brands.id))
		.where(and(eq(brandSuppliers.supplierId, supplierId), isNull(brands.deletedAt)));

	return rows.map((row) => row.brandId);
}

export async function getSuppliersByBrand(
	brandId: string,
	executor: DbOrTx = db
): Promise<NamedRelationOption[]> {
	return executor
		.select({
			id: suppliers.id,
			name: suppliers.name
		})
		.from(brandSuppliers)
		.innerJoin(suppliers, eq(brandSuppliers.supplierId, suppliers.id))
		.where(and(eq(brandSuppliers.brandId, brandId), isNull(suppliers.deletedAt)))
		.orderBy(asc(suppliers.name));
}

export async function getBrandsBySupplier(
	supplierId: string,
	executor: DbOrTx = db
): Promise<NamedRelationOption[]> {
	return executor
		.select({
			id: brands.id,
			name: brands.name
		})
		.from(brandSuppliers)
		.innerJoin(brands, eq(brandSuppliers.brandId, brands.id))
		.where(and(eq(brandSuppliers.supplierId, supplierId), isNull(brands.deletedAt)))
		.orderBy(asc(brands.name));
}
