import { eq, isNull, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	lensMaterials,
	lensTreatments,
	lensCatalogItems,
	supplierLensTreatments,
	suppliers,
	type LensMaterial,
	type NewLensMaterial,
	type LensTreatment,
	type NewLensTreatment,
	type LensCatalogItem,
	type NewLensCatalogItem
} from '$lib/server/db/schema';

// ============================================================================
// LENS MATERIALS
// ============================================================================

export async function getAllLensMaterials(): Promise<LensMaterial[]> {
	return await db
		.select()
		.from(lensMaterials)
		.where(and(isNull(lensMaterials.deletedAt), eq(lensMaterials.isActive, true)));
}

export async function findLensMaterialById(id: string): Promise<LensMaterial | null> {
	const [material] = await db
		.select()
		.from(lensMaterials)
		.where(and(eq(lensMaterials.id, id), isNull(lensMaterials.deletedAt)));
	return material ?? null;
}

export async function findLensMaterialByCode(code: string): Promise<LensMaterial | null> {
	const [material] = await db
		.select()
		.from(lensMaterials)
		.where(and(eq(lensMaterials.code, code), isNull(lensMaterials.deletedAt)));
	return material ?? null;
}

export async function createLensMaterial(data: NewLensMaterial): Promise<LensMaterial> {
	const now = new Date();
	const [material] = await db
		.insert(lensMaterials)
		.values({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
		.returning();
	return material;
}

// ============================================================================
// LENS TREATMENTS
// ============================================================================

export async function getAllLensTreatments(): Promise<LensTreatment[]> {
	return await db
		.select()
		.from(lensTreatments)
		.where(and(isNull(lensTreatments.deletedAt), eq(lensTreatments.isActive, true)));
}

export async function findLensTreatmentById(id: string): Promise<LensTreatment | null> {
	const [treatment] = await db
		.select()
		.from(lensTreatments)
		.where(and(eq(lensTreatments.id, id), isNull(lensTreatments.deletedAt)));
	return treatment ?? null;
}

export async function findLensTreatmentByCode(code: string): Promise<LensTreatment | null> {
	const [treatment] = await db
		.select()
		.from(lensTreatments)
		.where(and(eq(lensTreatments.code, code), isNull(lensTreatments.deletedAt)));
	return treatment ?? null;
}

export async function createLensTreatment(data: NewLensTreatment): Promise<LensTreatment> {
	const now = new Date();
	const [treatment] = await db
		.insert(lensTreatments)
		.values({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
		.returning();
	return treatment;
}

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

export type LensCatalogItemWithRelations = LensCatalogItem & {
	material: { id: string; name: string; code: string } | null;
	supplier: { id: string; name: string } | null;
};

export async function getAllLensCatalogItems(): Promise<LensCatalogItem[]> {
	return await db
		.select()
		.from(lensCatalogItems)
		.where(and(isNull(lensCatalogItems.deletedAt), eq(lensCatalogItems.isActive, true)));
}

export async function getLensCatalogItemsWithRelations(): Promise<LensCatalogItemWithRelations[]> {
	const results = await db
		.select({
			item: lensCatalogItems,
			material: { id: lensMaterials.id, name: lensMaterials.name, code: lensMaterials.code },
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.where(and(isNull(lensCatalogItems.deletedAt), eq(lensCatalogItems.isActive, true)));

	return results.map((r) => ({
		...r.item,
		material: r.material,
		supplier: r.supplier
	}));
}

export async function findLensCatalogItemById(id: string): Promise<LensCatalogItem | null> {
	const [item] = await db
		.select()
		.from(lensCatalogItems)
		.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)));
	return item ?? null;
}

export async function createLensCatalogItem(data: NewLensCatalogItem): Promise<LensCatalogItem> {
	const now = new Date();
	const [item] = await db
		.insert(lensCatalogItems)
		.values({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
		.returning();
	return item;
}

// ============================================================================
// SUPPLIER LENS TREATMENTS
// ============================================================================

export async function getSupplierTreatments(supplierId: string) {
	return await db
		.select({
			id: supplierLensTreatments.id,
			price: supplierLensTreatments.price,
			isAvailable: supplierLensTreatments.isAvailable,
			treatment: { id: lensTreatments.id, name: lensTreatments.name, code: lensTreatments.code }
		})
		.from(supplierLensTreatments)
		.innerJoin(lensTreatments, eq(supplierLensTreatments.treatmentId, lensTreatments.id))
		.where(
			and(
				eq(supplierLensTreatments.supplierId, supplierId),
				isNull(supplierLensTreatments.deletedAt)
			)
		);
}
