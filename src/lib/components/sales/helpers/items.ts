/**
 * Item lookups + display grouping helpers for the sale wizard.
 * Pure functions that operate on SaleItemRow + data arrays.
 */

import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { computeDiscount } from '$lib/utils';

import type { SaleItemRow } from '../newSaleTypes';

export function findProduct(
	item: SaleItemRow,
	products: ProductWithRelations[]
): ProductWithRelations | undefined {
	if (item.kind === 'product' && item.productId) {
		return products.find((p) => p.id === item.productId);
	}
	return undefined;
}

export function findLensItem(
	item: SaleItemRow,
	lensItems: LensCatalogItemWithRelations[]
): LensCatalogItemWithRelations | undefined {
	if (item.kind !== 'lens' || !item.lensPair.catalogItemId) return undefined;
	return lensItems.find((l) => l.id === item.lensPair.catalogItemId);
}

export function getItemName(
	item: SaleItemRow,
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[]
): string {
	if (item.kind === 'product') {
		return findProduct(item, products)?.name ?? '-';
	}
	if (item.kind === 'treatment') {
		return item.treatmentName;
	}
	return findLensItem(item, lensItems)?.name ?? '-';
}

export function getRequestedProductQuantity(
	items: SaleItemRow[],
	productId: string,
	excludeItemId?: string
): number {
	return items.reduce((sum, item) => {
		if (item.kind !== 'product' || item.productId !== productId || item.id === excludeItemId) {
			return sum;
		}

		return sum + Math.max(item.quantity, 0);
	}, 0);
}

export function getAvailableProductStock(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	productId: string,
	excludeItemId?: string
): number | null {
	if (!productId) return null;

	const product = products.find((candidate) => candidate.id === productId);
	const stock = product?.stock ?? null;
	if (stock === null) return null;

	return Math.max(stock - getRequestedProductQuantity(items, productId, excludeItemId), 0);
}

export interface PersistedDisplayGroup<
	T extends {
		id: string;
		itemType: string;
		lensCatalogItemId: string | null;
		quantity: number;
		unitPrice: number;
		discount: number;
		discountType: string;
	}
> {
	key: string;
	item: T;
	quantity: number;
	discountAmount: number;
	lineTotal: number;
	treatments: T[];
}

export function buildPersistedDisplayGroups<
	T extends {
		id: string;
		itemType: string;
		lensCatalogItemId: string | null;
		odSphere?: number | null;
		odCylinder?: number | null;
		odAxis?: number | null;
		odAddition?: number | null;
		osSphere?: number | null;
		osCylinder?: number | null;
		osAxis?: number | null;
		osAddition?: number | null;
		quantity: number;
		unitPrice: number;
		discount: number;
		discountType: string;
	}
>(
	items: T[],
	mainItems: T[],
	lensPairType: string,
	treatmentType: string,
	getParentId: (item: T) => string | null | undefined
): PersistedDisplayGroup<T>[] {
	const groups: PersistedDisplayGroup<T>[] = [];
	const lensGroupMap = new Map<string, PersistedDisplayGroup<T>>();

	function isLegacySplitLensItem(item: T): boolean {
		const hasOdValues =
			item.odSphere != null ||
			item.odCylinder != null ||
			item.odAxis != null ||
			item.odAddition != null;
		const hasOsValues =
			item.osSphere != null ||
			item.osCylinder != null ||
			item.osAxis != null ||
			item.osAddition != null;

		// Legacy sales/quotes stored one row per eye but always wrote the Rx into OD fields.
		// Only those ambiguous historical rows should be merged for display.
		return hasOdValues && !hasOsValues;
	}

	function getTreatments(parentId: string): T[] {
		return items.filter(
			(item) => item.itemType === treatmentType && getParentId(item) === parentId
		);
	}

	for (const item of mainItems) {
		const discountAmount = computeDiscount(
			item.discount,
			item.discountType,
			item.unitPrice * item.quantity
		);
		const lineTotal = item.unitPrice * item.quantity - discountAmount;

		if (item.itemType === lensPairType && item.lensCatalogItemId && isLegacySplitLensItem(item)) {
			const existing = lensGroupMap.get(item.lensCatalogItemId);
			if (existing) {
				existing.quantity += item.quantity;
				existing.discountAmount += discountAmount;
				existing.lineTotal += lineTotal;
				existing.treatments.push(...getTreatments(item.id));
			} else {
				const group: PersistedDisplayGroup<T> = {
					key: `lens-${item.lensCatalogItemId}`,
					item,
					quantity: item.quantity,
					discountAmount,
					lineTotal,
					treatments: [...getTreatments(item.id)]
				};

				lensGroupMap.set(item.lensCatalogItemId, group);
				groups.push(group);
			}
		} else {
			groups.push({
				key: item.id,
				item,
				quantity: item.quantity,
				discountAmount,
				lineTotal,
				treatments: getTreatments(item.id)
			});
		}
	}

	return groups;
}

/** Get the number of enabled eyes for a lens item. */
export function getEnabledEyeCount(item: SaleItemRow): number {
	if (item.kind !== 'lens') return 0;
	return (item.lensPair.od.enabled ? 1 : 0) + (item.lensPair.oi.enabled ? 1 : 0);
}
