import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import { nowISO } from '$lib/dates';
import { db } from '$lib/server/db';
import {
	brandAccessories,
	products,
	type BrandAccessory,
	type NewBrandAccessory
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { ProductType } from '$lib/shared/enums/productTypes';

export interface AccessoryProductSummary {
	id: string;
	name: string;
	sku: string;
	stock: number;
	type: string;
}

export interface BrandAccessoryRuleRow {
	id: number;
	brandId: string;
	productId: string | null;
	accessoryProductId: string;
	defaultPrice: number;
	isActive: boolean;
	accessory: AccessoryProductSummary;
}

export interface ProductAccessoryOverride {
	productId: string;
	brandId: string;
	isActive: boolean;
	accessories: BrandAccessoryRuleRow[];
}

export interface ResolvedAccessoryRule {
	ruleId: number;
	accessoryProductId: string;
	defaultPrice: number;
	accessory: AccessoryProductSummary;
}

export interface UpsertBrandAccessoryData {
	id?: number;
	brandId: string;
	productId?: string | null;
	accessoryProductId: string;
	defaultPrice: number;
	isActive?: boolean;
	createdById: string;
}

type BrandAccessoryJoinRow = {
	rule: BrandAccessory;
	accessory: AccessoryProductSummary | null;
};

type ProductSelection = {
	id: string;
	brandId: string | null;
	type: string;
	name: string;
};

const ELIGIBLE_PRODUCT_TYPES = new Set([ProductType.FRAME, ProductType.SUNGLASSES]);

function isEligibleAccessoryHost(productType: string): boolean {
	return ELIGIBLE_PRODUCT_TYPES.has(productType as ProductType);
}

function mapAccessorySummary(row: BrandAccessoryJoinRow): BrandAccessoryRuleRow | null {
	if (!row.rule.accessoryProductId || !row.accessory?.id) return null;

	return {
		id: row.rule.id,
		brandId: row.rule.brandId,
		productId: row.rule.productId,
		accessoryProductId: row.rule.accessoryProductId,
		defaultPrice: row.rule.defaultPrice,
		isActive: row.rule.isActive,
		accessory: row.accessory
	};
}

function mapResolvedAccessory(row: BrandAccessoryJoinRow): ResolvedAccessoryRule | null {
	const summary = mapAccessorySummary(row);
	if (!summary) return null;

	return {
		ruleId: summary.id,
		accessoryProductId: summary.accessoryProductId,
		defaultPrice: summary.defaultPrice,
		accessory: summary.accessory
	};
}

async function getHostProduct(
	productId: string,
	executor: DbOrTx = db
): Promise<ProductSelection | null> {
	const [product] = await executor
		.select({
			id: products.id,
			brandId: products.brandId,
			type: products.type,
			name: products.name
		})
		.from(products)
		.where(and(eq(products.id, productId), isNull(products.deletedAt)));

	return product ?? null;
}

async function getAccessoryProduct(
	accessoryProductId: string,
	executor: DbOrTx = db
): Promise<AccessoryProductSummary | null> {
	const [product] = await executor
		.select({
			id: products.id,
			name: products.name,
			sku: products.sku,
			stock: products.stock,
			type: products.type
		})
		.from(products)
		.where(and(eq(products.id, accessoryProductId), isNull(products.deletedAt)));

	return product ?? null;
}

async function getBrandAccessoryRows(
	brandId: string,
	executor: DbOrTx = db
): Promise<BrandAccessoryJoinRow[]> {
	return executor
		.select({
			rule: brandAccessories,
			accessory: {
				id: products.id,
				name: products.name,
				sku: products.sku,
				stock: products.stock,
				type: products.type
			}
		})
		.from(brandAccessories)
		.leftJoin(products, eq(brandAccessories.accessoryProductId, products.id))
		.where(
			and(
				eq(brandAccessories.brandId, brandId),
				isNull(brandAccessories.productId),
				eq(brandAccessories.isActive, true),
				isNotNull(brandAccessories.accessoryProductId)
			)
		)
		.orderBy(asc(products.name), asc(brandAccessories.id));
}

async function getProductOverrideRows(
	productId: string,
	brandId: string,
	executor: DbOrTx = db
): Promise<BrandAccessoryJoinRow[]> {
	return executor
		.select({
			rule: brandAccessories,
			accessory: {
				id: products.id,
				name: products.name,
				sku: products.sku,
				stock: products.stock,
				type: products.type
			}
		})
		.from(brandAccessories)
		.leftJoin(products, eq(brandAccessories.accessoryProductId, products.id))
		.where(and(eq(brandAccessories.brandId, brandId), eq(brandAccessories.productId, productId)))
		.orderBy(asc(products.name), asc(brandAccessories.id));
}

async function findExistingRule(
	data: Pick<UpsertBrandAccessoryData, 'brandId' | 'productId' | 'accessoryProductId'>,
	executor: DbOrTx = db
): Promise<BrandAccessory | null> {
	const [existing] = await executor
		.select()
		.from(brandAccessories)
		.where(
			and(
				eq(brandAccessories.brandId, data.brandId),
				data.productId
					? eq(brandAccessories.productId, data.productId)
					: isNull(brandAccessories.productId),
				eq(brandAccessories.accessoryProductId, data.accessoryProductId)
			)
		);

	return existing ?? null;
}

async function reactivateProductOverrideRows(
	productId: string,
	brandId: string,
	executor: DbOrTx = db
): Promise<void> {
	const now = nowISO();

	await executor
		.delete(brandAccessories)
		.where(
			and(
				eq(brandAccessories.productId, productId),
				eq(brandAccessories.brandId, brandId),
				isNull(brandAccessories.accessoryProductId)
			)
		);

	await executor
		.update(brandAccessories)
		.set({ isActive: true, updatedAt: now })
		.where(
			and(
				eq(brandAccessories.productId, productId),
				eq(brandAccessories.brandId, brandId),
				isNotNull(brandAccessories.accessoryProductId),
				eq(brandAccessories.isActive, false)
			)
		);
}

async function assertAccessoryProduct(
	accessoryProductId: string,
	executor: DbOrTx = db
): Promise<void> {
	const accessoryProduct = await getAccessoryProduct(accessoryProductId, executor);
	if (!accessoryProduct) {
		throw new Error('Accesorio no encontrado');
	}

	if (accessoryProduct.type !== ProductType.ACCESSORY) {
		throw new Error('Solo se pueden incluir productos de tipo ACCESSORY');
	}
}

async function assertProductOverrideTarget(
	productId: string,
	brandId: string,
	executor: DbOrTx = db
): Promise<void> {
	const product = await getHostProduct(productId, executor);
	if (!product) {
		throw new Error('Producto no encontrado');
	}

	if (!product.brandId || product.brandId !== brandId) {
		throw new Error('El producto no pertenece a la marca indicada');
	}

	if (!isEligibleAccessoryHost(product.type)) {
		throw new Error('Solo FRAME y SUNGLASSES admiten accesorios automáticos');
	}
}

export async function getAccessoriesForProduct(
	productId: string,
	brandId: string,
	executor: DbOrTx = db
): Promise<ResolvedAccessoryRule[]> {
	const product = await getHostProduct(productId, executor);
	if (!product?.brandId || product.brandId !== brandId || !isEligibleAccessoryHost(product.type)) {
		return [];
	}

	const overrideRows = await getProductOverrideRows(productId, brandId, executor);
	if (overrideRows.length > 0) {
		if (overrideRows.some((row) => row.rule.isActive === false)) {
			return [];
		}

		return overrideRows.map(mapResolvedAccessory).filter((row) => row !== null);
	}

	const brandRows = await getBrandAccessoryRows(brandId, executor);
	return brandRows.map(mapResolvedAccessory).filter((row) => row !== null);
}

export async function getBrandAccessories(
	brandId: string,
	executor: DbOrTx = db
): Promise<BrandAccessoryRuleRow[]> {
	const rows = await getBrandAccessoryRows(brandId, executor);
	return rows.map(mapAccessorySummary).filter((row) => row !== null);
}

export async function getProductAccessoryOverride(
	productId: string,
	executor: DbOrTx = db
): Promise<ProductAccessoryOverride | null> {
	const product = await getHostProduct(productId, executor);
	if (!product?.brandId || !isEligibleAccessoryHost(product.type)) {
		return null;
	}

	const rows = await getProductOverrideRows(productId, product.brandId, executor);
	if (rows.length === 0) {
		return null;
	}

	return {
		productId,
		brandId: product.brandId,
		isActive: !rows.some((row) => row.rule.isActive === false),
		accessories: rows.map(mapAccessorySummary).filter((row) => row !== null)
	};
}

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
	const nextValues: Partial<NewBrandAccessory> = {
		brandId: data.brandId,
		productId: data.productId ?? null,
		accessoryProductId: data.accessoryProductId,
		defaultPrice: data.defaultPrice,
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
			defaultPrice: data.defaultPrice,
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
		defaultPrice: 0,
		isActive: false,
		createdById,
		createdAt: now,
		updatedAt: now
	});
}
