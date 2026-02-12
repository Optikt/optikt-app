import { eq, isNull, and, ilike, desc } from 'drizzle-orm';
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

export async function findLensMaterialByName(name: string): Promise<LensMaterial | null> {
	const [material] = await db
		.select()
		.from(lensMaterials)
		.where(and(ilike(lensMaterials.name, name), isNull(lensMaterials.deletedAt)));
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

export async function updateLensMaterial(
	id: string,
	data: Partial<NewLensMaterial>
): Promise<LensMaterial | null> {
	const [updated] = await db
		.update(lensMaterials)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(lensMaterials.id, id), isNull(lensMaterials.deletedAt)))
		.returning();
	return updated ?? null;
}

export async function deleteLensMaterial(id: string): Promise<boolean> {
	const [deleted] = await db
		.update(lensMaterials)
		.set({ deletedAt: new Date() })
		.where(and(eq(lensMaterials.id, id), isNull(lensMaterials.deletedAt)))
		.returning({ id: lensMaterials.id });
	return !!deleted;
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

export async function findLensTreatmentByName(name: string): Promise<LensTreatment | null> {
	const [treatment] = await db
		.select()
		.from(lensTreatments)
		.where(and(ilike(lensTreatments.name, name), isNull(lensTreatments.deletedAt)));
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

export async function updateLensTreatment(
	id: string,
	data: Partial<NewLensTreatment>
): Promise<LensTreatment | null> {
	const [updated] = await db
		.update(lensTreatments)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(lensTreatments.id, id), isNull(lensTreatments.deletedAt)))
		.returning();
	return updated ?? null;
}

export async function deleteLensTreatment(id: string): Promise<boolean> {
	const [deleted] = await db
		.update(lensTreatments)
		.set({ deletedAt: new Date() })
		.where(and(eq(lensTreatments.id, id), isNull(lensTreatments.deletedAt)))
		.returning({ id: lensTreatments.id });
	return !!deleted;
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

export async function getLensCatalogItemsWithRelations(options?: {
	search?: string;
	source?: string;
	supplierId?: string;
	materialId?: string;
	type?: string;
	technology?: string;
}): Promise<LensCatalogItemWithRelations[]> {
	const conditions = [isNull(lensCatalogItems.deletedAt), eq(lensCatalogItems.isActive, true)];

	if (options?.source) {
		conditions.push(eq(lensCatalogItems.source, options.source as 'FINISHED' | 'LAB'));
	}
	if (options?.supplierId) {
		conditions.push(eq(lensCatalogItems.supplierId, options.supplierId));
	}
	if (options?.materialId) {
		conditions.push(eq(lensCatalogItems.materialId, options.materialId));
	}
	if (options?.type) {
		conditions.push(eq(lensCatalogItems.type, options.type));
	}
	if (options?.technology) {
		conditions.push(ilike(lensCatalogItems.technology, `%${options.technology}%`));
	}

	const results = await db
		.select({
			item: lensCatalogItems,
			material: { id: lensMaterials.id, name: lensMaterials.name, code: lensMaterials.code },
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.where(and(...conditions))
		.orderBy(desc(lensCatalogItems.createdAt));

	let items = results.map((r) => ({
		...r.item,
		material: r.material,
		supplier: r.supplier
	}));

	// Text search in memory (name, brand, supplier name, material name)
	if (options?.search) {
		const searchLower = options.search.toLowerCase();
		items = items.filter(
			(item) =>
				item.name.toLowerCase().includes(searchLower) ||
				item.brand?.toLowerCase().includes(searchLower) ||
				item.technology?.toLowerCase().includes(searchLower) ||
				item.supplier?.name.toLowerCase().includes(searchLower) ||
				item.material?.name.toLowerCase().includes(searchLower)
		);
	}

	return items;
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

export async function updateLensCatalogItem(
	id: string,
	data: Partial<NewLensCatalogItem>
): Promise<LensCatalogItem | null> {
	const [updated] = await db
		.update(lensCatalogItems)
		.set({ ...data, updatedAt: new Date() })
		.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)))
		.returning();
	return updated ?? null;
}

export async function deleteLensCatalogItem(id: string): Promise<boolean> {
	const [deleted] = await db
		.update(lensCatalogItems)
		.set({ deletedAt: new Date() })
		.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)))
		.returning({ id: lensCatalogItems.id });
	return !!deleted;
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

export async function upsertSupplierTreatment(data: {
	supplierId: string;
	treatmentId: string;
	price: number;
	isAvailable?: boolean;
}) {
	// Try to find existing
	const [existing] = await db
		.select()
		.from(supplierLensTreatments)
		.where(
			and(
				eq(supplierLensTreatments.supplierId, data.supplierId),
				eq(supplierLensTreatments.treatmentId, data.treatmentId),
				isNull(supplierLensTreatments.deletedAt)
			)
		);

	const now = new Date();

	if (existing) {
		const [updated] = await db
			.update(supplierLensTreatments)
			.set({ price: data.price, isAvailable: data.isAvailable ?? true, updatedAt: now })
			.where(eq(supplierLensTreatments.id, existing.id))
			.returning();
		return updated;
	}

	const [created] = await db
		.insert(supplierLensTreatments)
		.values({
			...data,
			id: crypto.randomUUID(),
			isAvailable: data.isAvailable ?? true,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return created;
}

export async function deleteSupplierTreatment(id: string): Promise<boolean> {
	const [deleted] = await db
		.update(supplierLensTreatments)
		.set({ deletedAt: new Date() })
		.where(and(eq(supplierLensTreatments.id, id), isNull(supplierLensTreatments.deletedAt)))
		.returning({ id: supplierLensTreatments.id });
	return !!deleted;
}
