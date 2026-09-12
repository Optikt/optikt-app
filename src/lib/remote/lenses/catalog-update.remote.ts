/**
 * Lenses remote — catalog update
 * Split from lenses.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { toRangeSemantic, rangesAreEqual, summarizeRanges } from './shared';
import { form } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { invalid } from '@sveltejs/kit';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';

import { lensCatalogItems, lensOpticalRanges } from '$lib/server/db/schema';
import { UpdateLensCatalogItemSchema } from '$lib/schemas/lenses';

import {
	resolvePendingLensMaterial,
	resolvePendingTechnology
} from '$lib/server/db/queries/lenses';

import { resolvePendingSupplier } from '$lib/server/db/queries/suppliers';
import type { LensCatalogItem, LensOpticalRange, NewLensCatalogItem } from '$lib/server/db/schema';

import { auditService, getAuditContext, calculateDiff, hasChanges } from '$lib/server/audit';
import { nowISO } from '$lib/dates';

import { computePairPurchasePrice } from '$lib/shared/pairPurchasePrice';
export const updateLensCatalogItemForm = form(
	UpdateLensCatalogItemSchema,
	async (data): Promise<LensCatalogItem & { ranges: LensOpticalRange[] }> => {
		requireAdmin();

		const {
			id,
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

		const { oldItem, result, rangesChanged, oldRangesSummary, newRangesSummary } =
			await db.transaction(async (tx) => {
				const now = nowISO();

				const [existing] = await tx
					.select()
					.from(lensCatalogItems)
					.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)));
				if (!existing) {
					invalid('Item de catálogo no encontrado');
				}

				// Capture old state for audit
				const oldItem = { ...existing };

				// Fetch current optical ranges for comparison
				const currentRanges = await tx
					.select()
					.from(lensOpticalRanges)
					.where(eq(lensOpticalRanges.lensCatalogItemId, id));

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
				const stockOverride =
					inventoryMode === 'ON_DEMAND' ? { stock: null } : stock !== undefined ? {} : { stock: 0 };

				// Recompute pairPurchasePrice from the effective basePrice and priceType
				const effectiveBasePrice = basePrice ?? existing.basePrice;
				const effectivePriceType = priceType ?? existing.priceType;
				const pairPurchasePrice = computePairPurchasePrice(effectiveBasePrice, effectivePriceType);

				const updateValues: Partial<NewLensCatalogItem> = {
					...(source !== undefined && { source }),
					...(name !== undefined && { name }),
					...(type !== undefined && { type }),
					...(technologyId !== undefined && { technologyId: technologyId || null }),
					...(differentiators !== undefined && { differentiators }),
					...(supplierId !== undefined && { supplierId }),
					...(materialId !== undefined && { materialId }),
					...(hasAr !== undefined && { hasAr }),
					...(arColors !== undefined && { arColors }),
					...(hasBluecut !== undefined && { hasBluecut }),
					...(isPhotochromic !== undefined && { isPhotochromic }),
					...(photochromicColors !== undefined && { photochromicColors }),
					...(priceType !== undefined && { priceType }),
					...(basePrice !== undefined && { basePrice }),
					...(salePrice !== undefined && { salePrice }),
					...(mountingPrice !== undefined && { mountingPrice }),
					...(shippingPrice !== undefined && { shippingPrice }),
					...(isTaxable !== undefined && { isTaxable }),
					...(inventoryMode !== undefined && { inventoryMode }),
					...(notes !== undefined && { notes }),
					...stockOverride,
					pairPurchasePrice,
					updatedAt: now
				};

				const [updated] = await tx
					.update(lensCatalogItems)
					.set(updateValues)
					.where(eq(lensCatalogItems.id, id))
					.returning();

				if (!updated) invalid('Error actualizando item');

				// Handle optical ranges - only delete/reinsert if semantically changed
				let insertedRanges: LensOpticalRange[];
				let rangesChanged = false;
				let oldRangesSummary = '';
				let newRangesSummary = '';

				if (ranges) {
					// Normalize incoming ranges for comparison
					const normalizedNew = ranges.map((r) => {
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
							additionMax: addA != null && addB != null ? Math.max(addA, addB) : addB
						};
					});

					if (rangesAreEqual(currentRanges, normalizedNew)) {
						// Ranges haven't changed - keep existing rows
						insertedRanges = currentRanges;
					} else {
						// Ranges changed - delete and reinsert
						rangesChanged = true;
						oldRangesSummary = summarizeRanges(currentRanges.map(toRangeSemantic));
						newRangesSummary = summarizeRanges(normalizedNew.map(toRangeSemantic));

						await tx.delete(lensOpticalRanges).where(eq(lensOpticalRanges.lensCatalogItemId, id));

						const rangeValues = normalizedNew.map((r) => ({
							...r,
							id: crypto.randomUUID(),
							lensCatalogItemId: id,
							createdAt: now,
							updatedAt: now
						}));
						insertedRanges =
							rangeValues.length > 0
								? await tx.insert(lensOpticalRanges).values(rangeValues).returning()
								: [];
					}
				} else {
					insertedRanges = currentRanges;
				}

				return {
					oldItem,
					result: { ...updated, ranges: insertedRanges },
					rangesChanged,
					oldRangesSummary,
					newRangesSummary
				};
			});

		// Log the update after transaction succeeds
		const auditCtx = getAuditContext();

		// Calculate field-level diff (exclude ranges - handled separately as summary)
		const fieldChanges = calculateDiff(oldItem, result, ['ranges']);

		// Add optical range changes as a human-readable summary
		if (rangesChanged) {
			fieldChanges.rangosÓpticos = {
				old: oldRangesSummary,
				new: newRangesSummary
			};
		}

		// Only log if there are actual changes
		if (hasChanges(fieldChanges)) {
			await auditService.logCustom('lens_catalog_item', id, 'update', fieldChanges, auditCtx);
		}

		return result;
	}
);
