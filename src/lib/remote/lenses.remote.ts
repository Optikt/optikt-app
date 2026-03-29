/**
 * Lenses Remote Functions
 * Server-side functions for managing lens materials, treatments, and catalog items
 */
import { query, form, command } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lensCatalogItems, lensOpticalRanges } from '$lib/server/db/schema';
import {
	CreateLensMaterialSchema,
	UpdateLensMaterialSchema,
	CreateLensCatalogItemSchema,
	UpdateLensCatalogItemSchema,
	LensIdSchema,
	ListLensCatalogSchema
} from '$lib/schemas/lenses';
import {
	getAllLensMaterials,
	findLensMaterialById,
	findLensMaterialByName,
	findLensMaterialByCode,
	createLensMaterial,
	updateLensMaterial,
	deleteLensMaterial,
	getLensCatalogItemsWithRelations,
	findLensCatalogItemById,
	deleteLensCatalogItem,
	resolvePendingLensMaterial
} from '$lib/server/db/queries/lenses';
import { resolvePendingSupplier } from '$lib/server/db/queries/suppliers';
import type { LensMaterial, LensCatalogItem, LensOpticalRange } from '$lib/server/db/schema';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { auditService, getAuditContext, calculateDiff, hasChanges } from '$lib/server/audit';

// ============================================================================
// OPTICAL RANGE COMPARISON HELPERS
// ============================================================================

/**
 * Semantic representation of an optical range (without DB-specific fields).
 * Used for comparison and human-readable history.
 */
interface RangeSemantic {
	sphereMin: number;
	sphereMax: number;
	cylinderMin: number | null;
	cylinderMax: number | null;
	additionMin: number | null;
	additionMax: number | null;
}

/**
 * Extract only the semantically meaningful fields from an optical range,
 * sorted consistently for stable comparison.
 */
function toRangeSemantic(r: {
	sphereMin: number;
	sphereMax: number;
	cylinderMin?: number | null;
	cylinderMax?: number | null;
	additionMin?: number | null;
	additionMax?: number | null;
}): RangeSemantic {
	return {
		sphereMin: r.sphereMin,
		sphereMax: r.sphereMax,
		cylinderMin: r.cylinderMin ?? null,
		cylinderMax: r.cylinderMax ?? null,
		additionMin: r.additionMin ?? null,
		additionMax: r.additionMax ?? null
	};
}

/**
 * Sort ranges by sphereMin, then sphereMax for deterministic ordering.
 */
function sortRanges(ranges: RangeSemantic[]): RangeSemantic[] {
	return [...ranges].sort((a, b) => a.sphereMin - b.sphereMin || a.sphereMax - b.sphereMax);
}

/**
 * Check if two sets of optical ranges are semantically identical.
 * Ignores id, createdAt, updatedAt, mirrorGroup, lensCatalogItemId.
 */
function rangesAreEqual(
	oldRanges: LensOpticalRange[],
	newRanges: {
		sphereMin: number;
		sphereMax: number;
		cylinderMin?: number | null;
		cylinderMax?: number | null;
		additionMin?: number | null;
		additionMax?: number | null;
	}[]
): boolean {
	if (oldRanges.length !== newRanges.length) return false;
	const oldSorted = sortRanges(oldRanges.map(toRangeSemantic));
	const newSorted = sortRanges(newRanges.map(toRangeSemantic));
	return JSON.stringify(oldSorted) === JSON.stringify(newSorted);
}

/**
 * Format a diopter value for display (e.g. -6.00, +4.00).
 */
function fmtDiopter(n: number): string {
	return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

/**
 * Build a human-readable summary of an optical range set for audit history.
 * Example: "ESF -6.00 a +6.00 | ESF -4.00 a -0.25, CIL -2.00 a -0.25"
 */
function summarizeRanges(ranges: RangeSemantic[]): string {
	if (ranges.length === 0) return '(sin rangos)';
	const sorted = sortRanges(ranges);
	return sorted
		.map((r) => {
			const parts = [`ESF ${fmtDiopter(r.sphereMin)} a ${fmtDiopter(r.sphereMax)}`];
			if (r.cylinderMin != null && r.cylinderMax != null) {
				parts.push(`CIL ${fmtDiopter(r.cylinderMin)} a ${fmtDiopter(r.cylinderMax)}`);
			}
			if (r.additionMin != null && r.additionMax != null) {
				parts.push(`ADD ${fmtDiopter(r.additionMin)} a ${fmtDiopter(r.additionMax)}`);
			}
			return parts.join(', ');
		})
		.join(' | ');
}

// ============================================================================
// LENS MATERIALS
// ============================================================================

export const listLensMaterials = query('unchecked', async (): Promise<LensMaterial[]> => {
	return getAllLensMaterials();
});

export const createLensMaterialForm = form(
	CreateLensMaterialSchema,
	async (data, issue): Promise<LensMaterial> => {
		// Check for duplicate name
		const existingName = await findLensMaterialByName(data.name);
		if (existingName) {
			invalid(issue.name('Ya existe un material con este nombre'));
		}

		// Check for duplicate code
		const existingCode = await findLensMaterialByCode(data.code);
		if (existingCode) {
			invalid(issue.code('Ya existe un material con este código'));
		}

		const material = await createLensMaterial(data);
		await auditService.logCreate('lens_material', material, getAuditContext());
		return material;
	}
);

export const updateLensMaterialForm = form(
	UpdateLensMaterialSchema,
	async (data, issue): Promise<LensMaterial> => {
		const { id, ...updates } = data;

		const existing = await findLensMaterialById(id);
		if (!existing) {
			invalid('Material no encontrado');
		}

		// Check duplicate name if changing
		if (updates.name && updates.name !== existing.name) {
			const dup = await findLensMaterialByName(updates.name);
			if (dup) invalid(issue.name('Ya existe un material con este nombre'));
		}

		// Check duplicate code if changing
		if (updates.code && updates.code !== existing.code) {
			const dup = await findLensMaterialByCode(updates.code);
			if (dup) invalid(issue.code('Ya existe un material con este código'));
		}

		const updated = await updateLensMaterial(id, updates);
		if (!updated) invalid('Error actualizando material');
		await auditService.logUpdate('lens_material', id, existing, updated, getAuditContext());
		return updated;
	}
);

export const deleteLensMaterialById = command(LensIdSchema, async (data): Promise<void> => {
	const existing = await findLensMaterialById(data.id);
	if (!existing) throw new Error('Material no encontrado');

	const deleted = await deleteLensMaterial(data.id);
	if (!deleted) throw new Error('Error eliminando material');

	await auditService.logDelete('lens_material', existing, getAuditContext());
});

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

export const listLensCatalog = query(
	ListLensCatalogSchema,
	async (data): Promise<LensCatalogItemWithRelations[]> => {
		return getLensCatalogItemsWithRelations({
			search: data.search,
			source: data.source,
			supplierId: data.supplierId,
			materialId: data.materialId,
			type: data.type
		});
	}
);

export const createLensCatalogItemForm = form(
	CreateLensCatalogItemSchema,
	async (data): Promise<LensCatalogItem & { ranges: LensOpticalRange[] }> => {
		const {
			pendingSupplierName,
			pendingMaterialName,
			pendingMaterialRefractiveIndex,
			ranges,
			...rest
		} = data;
		let { supplierId, materialId } = data;

		const result = await db.transaction(async (tx) => {
			const now = new Date();

			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
			}

			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				materialId = await resolvePendingLensMaterial(
					pendingMaterialName,
					pendingMaterialRefractiveIndex,
					now,
					tx
				);
			}

			const [item] = await tx
				.insert(lensCatalogItems)
				.values({
					...rest,
					id: crypto.randomUUID(),
					supplierId,
					materialId,
					createdAt: now,
					updatedAt: now
				})
				.returning();

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

		// Log the creation after transaction succeeds (exclude ranges — they are separate entities)
		await auditService.logCreate('lens_catalog_item', result, getAuditContext(), {
			excludeFields: ['ranges']
		});

		return result;
	}
);

export const updateLensCatalogItemForm = form(
	UpdateLensCatalogItemSchema,
	async (data): Promise<LensCatalogItem & { ranges: LensOpticalRange[] }> => {
		const {
			id,
			pendingSupplierName,
			pendingMaterialName,
			pendingMaterialRefractiveIndex,
			ranges,
			...rest
		} = data;
		let { supplierId, materialId } = rest;

		const { oldItem, result, rangesChanged, oldRangesSummary, newRangesSummary } =
			await db.transaction(async (tx) => {
				const now = new Date();

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

				if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
					supplierId = await resolvePendingSupplier(pendingSupplierName, now, tx);
				}

				if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
					materialId = await resolvePendingLensMaterial(
						pendingMaterialName,
						pendingMaterialRefractiveIndex,
						now,
						tx
					);
				}

				const [updated] = await tx
					.update(lensCatalogItems)
					.set({
						...rest,
						...(supplierId !== undefined && { supplierId }),
						...(materialId !== undefined && { materialId }),
						updatedAt: now
					})
					.where(eq(lensCatalogItems.id, id))
					.returning();

				if (!updated) invalid('Error actualizando item');

				// Handle optical ranges — only delete/reinsert if semantically changed
				let insertedRanges: LensOpticalRange[] = [];
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
						// Ranges haven't changed — keep existing rows
						insertedRanges = currentRanges;
					} else {
						// Ranges changed — delete and reinsert
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

		// Calculate field-level diff (exclude ranges — handled separately as summary)
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

export const deleteLensCatalogItemById = command(LensIdSchema, async (data): Promise<void> => {
	const existing = await findLensCatalogItemById(data.id);
	if (!existing) throw new Error('Item de catálogo no encontrado');

	const deleted = await deleteLensCatalogItem(data.id);
	if (!deleted) throw new Error('Error eliminando item de catálogo');

	await auditService.logDelete('lens_catalog_item', existing, getAuditContext());
});
