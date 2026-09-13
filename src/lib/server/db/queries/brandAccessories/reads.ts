import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	getBrandAccessoryRows,
	getHostProduct,
	getProductOverrideRows,
	isEligibleAccessoryHost,
	mapAccessorySummary,
	mapResolvedAccessory
} from './internal';
import type {
	BrandAccessoryRuleRow,
	ProductAccessoryOverride,
	ResolvedAccessoryRule
} from './types';

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
