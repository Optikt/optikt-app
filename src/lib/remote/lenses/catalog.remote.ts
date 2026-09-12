/**
 * Lenses remote — catalog list + create
 * Split from lenses.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { query, form } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';

import { db } from '$lib/server/db';

import { lensCatalogItems, lensOpticalRanges } from '$lib/server/db/schema';
import { CreateLensCatalogItemSchema, ListLensCatalogSchema } from '$lib/schemas/lenses';

import {
	getLensCatalogItemsWithRelations,
	resolvePendingLensMaterial,
	resolvePendingTechnology
} from '$lib/server/db/queries/lenses';

import { resolvePendingSupplier } from '$lib/server/db/queries/suppliers';
import type { LensCatalogItem, LensOpticalRange, NewLensCatalogItem } from '$lib/server/db/schema';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { auditService, getAuditContext } from '$lib/server/audit';
import { nowISO } from '$lib/dates';

import { computePairPurchasePrice } from '$lib/shared/pairPurchasePrice';
// LENS CATALOG ITEMS
// ============================================================================

export const listLensCatalog = query(
	ListLensCatalogSchema,
	async (data): Promise<LensCatalogItemWithRelations[]> => {
		requireAuth();

		return getLensCatalogItemsWithRelations({
			search: data.search,
			source: data.source,
			supplierId: data.supplierId,
			materialId: data.materialId,
			type: data.type,
			technologyId: data.technologyId
		});
	}
);

export const createLensCatalogItemForm = form(
	CreateLensCatalogItemSchema,
	async (data): Promise<LensCatalogItem & { ranges: LensOpticalRange[] }> => {
		requireAdmin();

		const {
			source,
			name,
			type,
			differentiators,
			hasAr,
			arColors,
			hasBluecut,
			isPhotochromic,
			photochromicColors,
			priceType,
			basePrice,
			salePrice,
			mountingPrice,
			shippingPrice,
			isTaxable,
			inventoryMode,
			stock,
			notes,
			pendingSupplierName,
			pendingMaterialName,
			pendingMaterialRefractiveIndex,
			pendingTechnologyName,
			isGlobalTechnology,
			ranges
		} = data;
		let { supplierId, materialId, technologyId } = data;

		const result = await db.transaction(async (tx) => {
			const now = nowISO();

			if (
				typeof supplierId === 'string' &&
				supplierId.startsWith('pending_') &&
				pendingSupplierName
			) {
				supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
			}

			if (
				typeof materialId === 'string' &&
				materialId.startsWith('pending_material_') &&
				pendingMaterialName
			) {
				materialId = await resolvePendingLensMaterial(
					pendingMaterialName,
					pendingMaterialRefractiveIndex,
					now,
					tx
				);
			}

			if (
				typeof technologyId === 'string' &&
				technologyId.startsWith('pending_technology_') &&
				pendingTechnologyName
			) {
				const effectiveSupplierId =
					typeof supplierId === 'string' &&
					supplierId &&
					!supplierId.startsWith('pending_') &&
					!isGlobalTechnology
						? supplierId
						: null;
				technologyId = await resolvePendingTechnology(
					pendingTechnologyName,
					effectiveSupplierId,
					now,
					tx
				);
			}

			// inventoryMode drives stock: ON_DEMAND → null, STOCK → provided value
			const stockValue = inventoryMode === 'ON_DEMAND' ? null : (stock ?? 0);

			const pairPurchasePrice = computePairPurchasePrice(basePrice, priceType);

			const insertValues: NewLensCatalogItem = {
				id: crypto.randomUUID(),
				source,
				supplierId,
				name,
				type,
				materialId,
				hasAr,
				arColors,
				hasBluecut,
				isPhotochromic,
				photochromicColors,
				priceType,
				basePrice,
				salePrice,
				mountingPrice,
				shippingPrice,
				isTaxable,
				inventoryMode,
				stock: stockValue,
				notes,
				differentiators,
				pairPurchasePrice,
				createdAt: now,
				updatedAt: now,
				...(technologyId ? { technologyId } : {})
			};

			const [item] = await tx.insert(lensCatalogItems).values(insertValues).returning();

			// Insert optical ranges
			// Ensure min ≤ max ordering for cylinder/addition (required by
			// numrange GiST indexes) and use null instead of undefined.
			const rangeValues = ranges.map((r) => {
				const cylA = r.cylinderMin ?? null;
				const cylB = r.cylinderMax ?? null;
				const addA = r.additionMin ?? null;
				const addB = r.additionMax ?? null;
				return {
					sphereMin: r.sphereMin,
					sphereMax: r.sphereMax,
					cylinderMin: cylA != null && cylB != null ? Math.min(cylA, cylB) : cylA,
					cylinderMax: cylA != null && cylB != null ? Math.max(cylA, cylB) : cylB,
					additionMin: addA != null && addB != null ? Math.min(addA, addB) : addA,
					additionMax: addA != null && addB != null ? Math.max(addA, addB) : addB,
					id: crypto.randomUUID(),
					lensCatalogItemId: item.id,
					createdAt: now,
					updatedAt: now
				};
			});
			const insertedRanges =
				rangeValues.length > 0
					? await tx.insert(lensOpticalRanges).values(rangeValues).returning()
					: [];

			return { ...item, ranges: insertedRanges };
		});

		// Log the creation after transaction succeeds (exclude ranges - they are separate entities)
		await auditService.logCreate('lens_catalog_item', result, getAuditContext(), {
			excludeFields: ['ranges']
		});

		return result;
	}
);
