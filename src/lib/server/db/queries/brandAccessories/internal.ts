import { and, asc, eq, isNotNull, isNull, type SQL } from 'drizzle-orm';

import { nowISO } from '$lib/dates';
import { db } from '$lib/server/db';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import {
	brandAccessories,
	type BrandAccessory,
	type NewBrandAccessory
} from '$lib/server/db/schema/brandAccessories';
import { brands } from '$lib/server/db/schema/brands';
import { materials } from '$lib/server/db/schema/materials';
import { products, type Product } from '$lib/server/db/schema/products';
import { suppliers } from '$lib/server/db/schema/suppliers';
import type { DbOrTx } from '$lib/server/db/types';
import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
import { ProductType } from '$lib/shared/enums/productTypes';
import type {
	AccessoryProductSummary,
	BrandAccessoryRuleRow,
	ResolvedAccessoryRule,
	UpsertBrandAccessoryData
} from './types';

export type BrandAccessoryJoinRow = {
	rule: BrandAccessory;
	product: Product | null;
	brand: { id: string; name: string } | null;
	supplier: { id: string; name: string } | null;
	material: { id: string; name: string; code: string } | null;
};

const ACCESSORY_JOIN_SELECT = {
	rule: brandAccessories,
	product: products,
	brand: { id: brands.id, name: brands.name },
	supplier: { id: suppliers.id, name: suppliers.name },
	material: { id: materials.id, name: materials.name, code: materials.code }
};

export type ProductSelection = {
	id: string;
	brandId: string | null;
	type: string;
	name: string;
};

export const ELIGIBLE_PRODUCT_TYPES = new Set([ProductType.FRAME, ProductType.SUNGLASSES]);

export function isEligibleAccessoryHost(productType: string): boolean {
	return ELIGIBLE_PRODUCT_TYPES.has(productType as ProductType);
}

function mapAccessoryProduct(row: BrandAccessoryJoinRow): ProductWithRelations | null {
	if (!row.rule.accessoryProductId || !row.product?.id) return null;

	return {
		...row.product,
		brand: row.brand?.id ? row.brand : null,
		supplier: row.supplier?.id ? row.supplier : null,
		material: row.material?.id ? row.material : null
	};
}

export function mapAccessorySummary(row: BrandAccessoryJoinRow): BrandAccessoryRuleRow | null {
	if (!row.rule.accessoryProductId || !row.product?.id) return null;

	return {
		id: row.rule.id,
		brandId: row.rule.brandId,
		productId: row.rule.productId,
		accessoryProductId: row.rule.accessoryProductId,
		priceMode: row.rule.priceMode as BrandAccessoryPriceMode,
		customPrice: row.rule.customPrice,
		currentProductPrice: row.product.currentSalePrice,
		isActive: row.rule.isActive,
		accessory: {
			id: row.product.id,
			name: row.product.name,
			sku: row.product.sku,
			stock: row.product.stock,
			type: row.product.type,
			currentSalePrice: row.product.currentSalePrice
		}
	};
}

export function mapResolvedAccessory(row: BrandAccessoryJoinRow): ResolvedAccessoryRule | null {
	const accessory = mapAccessoryProduct(row);
	if (!accessory || !row.rule.accessoryProductId) return null;

	return {
		ruleId: row.rule.id,
		accessoryProductId: row.rule.accessoryProductId,
		priceMode: row.rule.priceMode as BrandAccessoryPriceMode,
		customPrice: row.rule.customPrice,
		currentProductPrice: accessory.currentSalePrice,
		accessory
	};
}

export function normalizePriceConfig(
	data: Pick<UpsertBrandAccessoryData, 'priceMode' | 'customPrice'>
): Pick<NewBrandAccessory, 'priceMode' | 'customPrice'> {
	if (data.priceMode === BrandAccessoryPriceMode.CUSTOM) {
		if (data.customPrice == null || data.customPrice <= 0) {
			throw new Error('Precio personalizado es requerido');
		}

		return {
			priceMode: data.priceMode,
			customPrice: data.customPrice
		};
	}

	return {
		priceMode: data.priceMode,
		customPrice: null
	};
}

export async function getHostProduct(
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

export async function getAccessoryProduct(
	accessoryProductId: string,
	executor: DbOrTx = db
): Promise<AccessoryProductSummary | null> {
	const [product] = await executor
		.select({
			id: products.id,
			name: products.name,
			sku: products.sku,
			stock: products.stock,
			type: products.type,
			currentSalePrice: products.currentSalePrice
		})
		.from(products)
		.where(and(eq(products.id, accessoryProductId), isNull(products.deletedAt)));

	return product ?? null;
}

async function selectAccessoryJoinRows(
	where: SQL | undefined,
	executor: DbOrTx
): Promise<BrandAccessoryJoinRow[]> {
	return executor
		.select(ACCESSORY_JOIN_SELECT)
		.from(brandAccessories)
		.leftJoin(
			products,
			and(eq(brandAccessories.accessoryProductId, products.id), isNull(products.deletedAt))
		)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.leftJoin(materials, eq(products.materialId, materials.id))
		.where(where)
		.orderBy(asc(products.name), asc(brandAccessories.id));
}

export async function getBrandAccessoryRows(
	brandId: string,
	executor: DbOrTx = db
): Promise<BrandAccessoryJoinRow[]> {
	return selectAccessoryJoinRows(
		and(
			eq(brandAccessories.brandId, brandId),
			isNull(brandAccessories.productId),
			eq(brandAccessories.isActive, true),
			isNotNull(brandAccessories.accessoryProductId)
		),
		executor
	);
}

export async function getProductOverrideRows(
	productId: string,
	brandId: string,
	executor: DbOrTx = db
): Promise<BrandAccessoryJoinRow[]> {
	return selectAccessoryJoinRows(
		and(eq(brandAccessories.brandId, brandId), eq(brandAccessories.productId, productId)),
		executor
	);
}

export async function findExistingRule(
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

export async function reactivateProductOverrideRows(
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

export async function assertAccessoryProduct(
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

export async function assertProductOverrideTarget(
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
