/**
 * Lenses Remote Functions
 * Server-side functions for managing lens materials, treatments, and catalog items
 */
import { query, form, command, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { eq, and, ilike, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	suppliers,
	lensMaterials,
	lensCatalogItems,
	lensOpticalRanges
} from '$lib/server/db/schema';
import {
	CreateLensMaterialSchema,
	UpdateLensMaterialSchema,
	CreateLensTreatmentSchema,
	UpdateLensTreatmentSchema,
	CreateLensCatalogItemSchema,
	UpdateLensCatalogItemSchema,
	LensIdSchema,
	ListLensCatalogSchema,
	SupplierIdSchema,
	UpsertSupplierTreatmentSchema
} from '$lib/schemas/lenses';
import {
	getAllLensMaterials,
	findLensMaterialById,
	findLensMaterialByName,
	findLensMaterialByCode,
	createLensMaterial,
	updateLensMaterial,
	deleteLensMaterial,
	getAllLensTreatments,
	findLensTreatmentById,
	findLensTreatmentByName,
	findLensTreatmentByCode,
	createLensTreatment,
	updateLensTreatment,
	deleteLensTreatment,
	getLensCatalogItemsWithRelations,
	findLensCatalogItemById,
	deleteLensCatalogItem,
	getSupplierTreatments,
	upsertSupplierTreatment,
	deleteSupplierTreatment
} from '$lib/server/db/queries/lenses';
import type {
	LensMaterial,
	LensTreatment,
	LensCatalogItem,
	LensOpticalRange
} from '$lib/server/db/schema';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { auditService, type AuditContext, calculateDiff, hasChanges } from '$lib/server/audit';

/**
 * Helper to build audit context from the request event
 */
function getAuditContext(): AuditContext {
	const event = getRequestEvent();
	return {
		userId: event.locals.user?.id ?? null,
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

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
	return [...ranges].sort(
		(a, b) => a.sphereMin - b.sphereMin || a.sphereMax - b.sphereMax
	);
}

/**
 * Check if two sets of optical ranges are semantically identical.
 * Ignores id, createdAt, updatedAt, mirrorGroup, lensCatalogItemId.
 */
function rangesAreEqual(
	oldRanges: LensOpticalRange[],
	newRanges: { sphereMin: number; sphereMax: number; cylinderMin?: number | null; cylinderMax?: number | null; additionMin?: number | null; additionMax?: number | null }[]
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
function summarizeRanges(
	ranges: RangeSemantic[]
): string {
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
// LENS TREATMENTS
// ============================================================================

export const listLensTreatments = query('unchecked', async (): Promise<LensTreatment[]> => {
	return getAllLensTreatments();
});

export const createLensTreatmentForm = form(
	CreateLensTreatmentSchema,
	async (data, issue): Promise<LensTreatment> => {
		const existingName = await findLensTreatmentByName(data.name);
		if (existingName) {
			invalid(issue.name('Ya existe un tratamiento con este nombre'));
		}

		const existingCode = await findLensTreatmentByCode(data.code);
		if (existingCode) {
			invalid(issue.code('Ya existe un tratamiento con este código'));
		}

		const treatment = await createLensTreatment(data);
		await auditService.logCreate('lens_treatment', treatment, getAuditContext());
		return treatment;
	}
);

export const updateLensTreatmentForm = form(
	UpdateLensTreatmentSchema,
	async (data, issue): Promise<LensTreatment> => {
		const { id, ...updates } = data;

		const existing = await findLensTreatmentById(id);
		if (!existing) {
			invalid('Tratamiento no encontrado');
		}

		if (updates.name && updates.name !== existing.name) {
			const dup = await findLensTreatmentByName(updates.name);
			if (dup) invalid(issue.name('Ya existe un tratamiento con este nombre'));
		}

		if (updates.code && updates.code !== existing.code) {
			const dup = await findLensTreatmentByCode(updates.code);
			if (dup) invalid(issue.code('Ya existe un tratamiento con este código'));
		}

		const updated = await updateLensTreatment(id, updates);
		if (!updated) invalid('Error actualizando tratamiento');
		await auditService.logUpdate('lens_treatment', id, existing, updated, getAuditContext());
		return updated;
	}
);

export const deleteLensTreatmentById = command(LensIdSchema, async (data): Promise<void> => {
	const existing = await findLensTreatmentById(data.id);
	if (!existing) throw new Error('Tratamiento no encontrado');

	const deleted = await deleteLensTreatment(data.id);
	if (!deleted) throw new Error('Error eliminando tratamiento');

	await auditService.logDelete('lens_treatment', existing, getAuditContext());
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
			type: data.type,
			technology: data.technology
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

			// Handle pending supplier
			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				const [existing] = await tx
					.select()
					.from(suppliers)
					.where(and(ilike(suppliers.name, pendingSupplierName), isNull(suppliers.deletedAt)));

				if (existing) {
					supplierId = existing.id;
				} else {
					const [newSupplier] = await tx
						.insert(suppliers)
						.values({
							id: crypto.randomUUID(),
							name: pendingSupplierName,
							type: 'DISTRIBUTOR',
							primaryPhone: '',
							createdAt: now,
							updatedAt: now
						})
						.returning();
					supplierId = newSupplier.id;
				}
			}

			// Handle pending material (lens_materials table)
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const [existing] = await tx
					.select()
					.from(lensMaterials)
					.where(
						and(ilike(lensMaterials.name, pendingMaterialName), isNull(lensMaterials.deletedAt))
					);

				if (existing) {
					materialId = existing.id;
				} else {
					const code = pendingMaterialName.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
					const [newMaterial] = await tx
						.insert(lensMaterials)
						.values({
							id: crypto.randomUUID(),
							name: pendingMaterialName,
							code,
							refractiveIndex: pendingMaterialRefractiveIndex ?? null,
							createdAt: now,
							updatedAt: now
						})
						.returning();
					materialId = newMaterial.id;
				}
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
					mirrorGroup: r.mirrorGroup ?? null,
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

		const { oldItem, result, rangesChanged, oldRangesSummary, newRangesSummary } = await db.transaction(async (tx) => {
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

			// Handle pending supplier
			if (supplierId && supplierId.startsWith('pending_') && pendingSupplierName) {
				const [existingSup] = await tx
					.select()
					.from(suppliers)
					.where(and(ilike(suppliers.name, pendingSupplierName), isNull(suppliers.deletedAt)));

				if (existingSup) {
					supplierId = existingSup.id;
				} else {
					const [newSupplier] = await tx
						.insert(suppliers)
						.values({
							id: crypto.randomUUID(),
							name: pendingSupplierName,
							type: 'DISTRIBUTOR',
							primaryPhone: '',
							createdAt: now,
							updatedAt: now
						})
						.returning();
					supplierId = newSupplier.id;
				}
			}

			// Handle pending material
			if (materialId && materialId.startsWith('pending_material_') && pendingMaterialName) {
				const [existingMat] = await tx
					.select()
					.from(lensMaterials)
					.where(
						and(ilike(lensMaterials.name, pendingMaterialName), isNull(lensMaterials.deletedAt))
					);

				if (existingMat) {
					materialId = existingMat.id;
				} else {
					const code = pendingMaterialName.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
					const [newMaterial] = await tx
						.insert(lensMaterials)
						.values({
							id: crypto.randomUUID(),
							name: pendingMaterialName,
							code,
							refractiveIndex: pendingMaterialRefractiveIndex ?? null,
							createdAt: now,
							updatedAt: now
						})
						.returning();
					materialId = newMaterial.id;
				}
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
						additionMax: addA != null && addB != null ? Math.max(addA, addB) : addB,
						mirrorGroup: r.mirrorGroup ?? null
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

// ============================================================================
// SUPPLIER LENS TREATMENTS
// ============================================================================

export const listSupplierTreatments = query(SupplierIdSchema, async (data) => {
	return getSupplierTreatments(data.supplierId);
});

export const upsertSupplierTreatmentCmd = command(UpsertSupplierTreatmentSchema, async (data) => {
	return upsertSupplierTreatment(data);
});

export const deleteSupplierTreatmentCmd = command(LensIdSchema, async (data): Promise<void> => {
	const deleted = await deleteSupplierTreatment(data.id);
	if (!deleted) throw new Error('Tratamiento de proveedor no encontrado');
});
