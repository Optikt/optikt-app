import { eq, isNull, and, ilike, desc, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { LensType, LensCatalogSource } from '$lib/shared/enums';
import type { DbOrTx } from '$lib/server/db/types';
import {
	lensMaterials,
	lensCatalogItems,
	lensOpticalRanges,
	suppliers,
	type LensMaterial,
	type NewLensMaterial,
	type LensCatalogItem,
	type NewLensCatalogItem,
	type LensOpticalRange,
	type NewLensOpticalRange
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';

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
	const now = nowISO();
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
		.set({ ...data, updatedAt: nowISO() })
		.where(and(eq(lensMaterials.id, id), isNull(lensMaterials.deletedAt)))
		.returning();
	return updated ?? null;
}

export async function deleteLensMaterial(id: string): Promise<boolean> {
	const [deleted] = await db
		.update(lensMaterials)
		.set({ deletedAt: nowISO() })
		.where(and(eq(lensMaterials.id, id), isNull(lensMaterials.deletedAt)))
		.returning({ id: lensMaterials.id });
	return !!deleted;
}

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

export type LensCatalogItemWithRelations = LensCatalogItem & {
	material: { id: string; name: string; code: string; refractiveIndex: number | null } | null;
	supplier: { id: string; name: string } | null;
	ranges: LensOpticalRange[];
};

export async function getAllLensCatalogItems(): Promise<LensCatalogItem[]> {
	return await db
		.select()
		.from(lensCatalogItems)
		.where(and(isNull(lensCatalogItems.deletedAt), eq(lensCatalogItems.isActive, true)));
}

export async function getLensCatalogItemsWithRelations(options?: {
	search?: string;
	source?: LensCatalogSource;
	supplierId?: string;
	materialId?: string;
	type?: LensType;
}): Promise<LensCatalogItemWithRelations[]> {
	const conditions = [isNull(lensCatalogItems.deletedAt), eq(lensCatalogItems.isActive, true)];

	if (options?.source) {
		conditions.push(eq(lensCatalogItems.source, options.source));
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

	const results = await db
		.select({
			item: lensCatalogItems,
			material: {
				id: lensMaterials.id,
				name: lensMaterials.name,
				code: lensMaterials.code,
				refractiveIndex: lensMaterials.refractiveIndex
			},
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
		supplier: r.supplier,
		ranges: [] as LensOpticalRange[]
	}));

	// Text search in memory (name, supplier name, material name)
	if (options?.search) {
		const searchLower = options.search.toLowerCase();
		items = items.filter(
			(item) =>
				item.name.toLowerCase().includes(searchLower) ||
				item.supplier?.name.toLowerCase().includes(searchLower) ||
				item.material?.name.toLowerCase().includes(searchLower)
		);
	}

	// Load ranges for each item
	if (items.length > 0) {
		const itemIds = items.map((i) => i.id);
		const ranges = await db
			.select()
			.from(lensOpticalRanges)
			.where(inArray(lensOpticalRanges.lensCatalogItemId, itemIds));
		const rangeMap = new Map<string, LensOpticalRange[]>();
		for (const r of ranges) {
			const arr = rangeMap.get(r.lensCatalogItemId) ?? [];
			arr.push(r);
			rangeMap.set(r.lensCatalogItemId, arr);
		}
		for (const item of items) {
			item.ranges = rangeMap.get(item.id) ?? [];
		}
	}

	return items;
}

export async function findLensCatalogItemById(
	id: string
): Promise<(LensCatalogItem & { ranges: LensOpticalRange[] }) | null> {
	const [item] = await db
		.select()
		.from(lensCatalogItems)
		.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)));
	if (!item) return null;

	const ranges = await db
		.select()
		.from(lensOpticalRanges)
		.where(eq(lensOpticalRanges.lensCatalogItemId, id));

	return { ...item, ranges };
}

export async function findLensCatalogItemByIdWithRelations(
	id: string
): Promise<LensCatalogItemWithRelations | null> {
	const [result] = await db
		.select({
			item: lensCatalogItems,
			material: {
				id: lensMaterials.id,
				name: lensMaterials.name,
				code: lensMaterials.code,
				refractiveIndex: lensMaterials.refractiveIndex
			},
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)));

	if (!result) return null;

	const ranges = await db
		.select()
		.from(lensOpticalRanges)
		.where(eq(lensOpticalRanges.lensCatalogItemId, id));

	return {
		...result.item,
		material: result.material,
		supplier: result.supplier,
		ranges
	};
}

export async function createLensCatalogItem(
	data: NewLensCatalogItem,
	ranges: Omit<NewLensOpticalRange, 'id' | 'lensCatalogItemId' | 'createdAt' | 'updatedAt'>[]
): Promise<LensCatalogItem & { ranges: LensOpticalRange[] }> {
	const now = nowISO();
	const itemId = crypto.randomUUID();

	return db.transaction(async (tx) => {
		const [item] = await tx
			.insert(lensCatalogItems)
			.values({ ...data, id: itemId, createdAt: now, updatedAt: now })
			.returning();

		const rangeValues = ranges.map((r) => ({
			...r,
			id: crypto.randomUUID(),
			lensCatalogItemId: itemId,
			createdAt: now,
			updatedAt: now
		}));

		const insertedRanges =
			rangeValues.length > 0
				? await tx.insert(lensOpticalRanges).values(rangeValues).returning()
				: [];

		return { ...item, ranges: insertedRanges };
	});
}

export async function updateLensCatalogItem(
	id: string,
	data: Partial<NewLensCatalogItem>,
	ranges?: Omit<NewLensOpticalRange, 'id' | 'lensCatalogItemId' | 'createdAt' | 'updatedAt'>[]
): Promise<(LensCatalogItem & { ranges: LensOpticalRange[] }) | null> {
	const now = nowISO();

	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(lensCatalogItems)
			.set({ ...data, updatedAt: now })
			.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)))
			.returning();

		if (!updated) return null;

		let insertedRanges: LensOpticalRange[] = [];
		if (ranges) {
			// Delete existing ranges and replace
			await tx.delete(lensOpticalRanges).where(eq(lensOpticalRanges.lensCatalogItemId, id));

			const rangeValues = ranges.map((r) => ({
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
		} else {
			// No range change — fetch current
			insertedRanges = await tx
				.select()
				.from(lensOpticalRanges)
				.where(eq(lensOpticalRanges.lensCatalogItemId, id));
		}

		return { ...updated, ranges: insertedRanges };
	});
}

export async function deleteLensCatalogItem(id: string): Promise<boolean> {
	const [deleted] = await db
		.update(lensCatalogItems)
		.set({ deletedAt: nowISO() })
		.where(and(eq(lensCatalogItems.id, id), isNull(lensCatalogItems.deletedAt)))
		.returning({ id: lensCatalogItems.id });
	return !!deleted;
}

/**
 * Resolve a pending lens material inside a transaction.
 * Looks up by name (case-insensitive); creates if not found.
 * Returns the resolved lens material ID.
 */
export async function resolvePendingLensMaterial(
	pendingName: string,
	refractiveIndex: number | null | undefined,
	now: string,
	executor: DbOrTx = db
): Promise<string> {
	const [existing] = await executor
		.select()
		.from(lensMaterials)
		.where(and(ilike(lensMaterials.name, pendingName), isNull(lensMaterials.deletedAt)));

	if (existing) return existing.id;

	const code = pendingName.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
	const [created] = await executor
		.insert(lensMaterials)
		.values({
			id: crypto.randomUUID(),
			name: pendingName,
			code,
			refractiveIndex: refractiveIndex ?? null,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return created.id;
}
