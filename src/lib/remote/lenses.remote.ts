/**
 * Lenses Remote Functions
 * Server-side functions for managing lens materials, treatments, and catalog items
 */
import { query, form, command } from '$app/server';
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

		return createLensMaterial(data);
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
		return updated;
	}
);

export const deleteLensMaterialById = command(LensIdSchema, async (data): Promise<void> => {
	const deleted = await deleteLensMaterial(data.id);
	if (!deleted) throw new Error('Material no encontrado');
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

		return createLensTreatment(data);
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
		return updated;
	}
);

export const deleteLensTreatmentById = command(LensIdSchema, async (data): Promise<void> => {
	const deleted = await deleteLensTreatment(data.id);
	if (!deleted) throw new Error('Tratamiento no encontrado');
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

		return db.transaction(async (tx) => {
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

		return db.transaction(async (tx) => {
			const now = new Date();

			const [existing] = await tx
				.select()
				.from(lensCatalogItems)
				.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)));
			if (!existing) {
				invalid('Item de catálogo no encontrado');
			}

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

			// Replace optical ranges if provided
			let insertedRanges: LensOpticalRange[] = [];
			if (ranges) {
				await tx.delete(lensOpticalRanges).where(eq(lensOpticalRanges.lensCatalogItemId, id));

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
						lensCatalogItemId: id,
						createdAt: now,
						updatedAt: now
					};
				});
				insertedRanges =
					rangeValues.length > 0
						? await tx.insert(lensOpticalRanges).values(rangeValues).returning()
						: [];
			} else {
				insertedRanges = await tx
					.select()
					.from(lensOpticalRanges)
					.where(eq(lensOpticalRanges.lensCatalogItemId, id));
			}

			return { ...updated, ranges: insertedRanges };
		});
	}
);

export const deleteLensCatalogItemById = command(LensIdSchema, async (data): Promise<void> => {
	const deleted = await deleteLensCatalogItem(data.id);
	if (!deleted) throw new Error('Item de catálogo no encontrado');
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
