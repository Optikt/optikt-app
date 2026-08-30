import { eq, isNull, and, or, ilike, desc, inArray, sql } from 'drizzle-orm';
import { computeRelevanceScore, matchesAllTokens } from '$lib/utils/search';
import { db } from '$lib/server/db';
import { LensType, LensCatalogSource, getLensSourceLabel } from '$lib/shared/enums';
import type { DbOrTx } from '$lib/server/db/types';
import {
	lensMaterials,
	lensCatalogItems,
	lensTechnologies,
	lensOpticalRanges,
	suppliers,
	type LensMaterial,
	type NewLensMaterial,
	type LensTechnology,
	type NewLensTechnology,
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
		.where(isNull(lensMaterials.deletedAt))
		.orderBy(lensMaterials.name);
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

export async function deleteLensMaterial(id: string, executor: DbOrTx = db): Promise<boolean> {
	const [deleted] = await executor
		.update(lensMaterials)
		.set({ deletedAt: nowISO(), updatedAt: nowISO() })
		.where(and(eq(lensMaterials.id, id), isNull(lensMaterials.deletedAt)))
		.returning({ id: lensMaterials.id });
	return !!deleted;
}

// ============================================================================
// LENS TECHNOLOGIES
// ============================================================================

export async function getTechnologiesBySupplier(
	supplierId?: string,
	includeTechnologyId?: string
): Promise<LensTechnology[]> {
	const orConditions: ReturnType<typeof isNull>[] = [isNull(lensTechnologies.supplierId)];

	if (supplierId) {
		orConditions.push(eq(lensTechnologies.supplierId, supplierId));
	}

	if (includeTechnologyId) {
		orConditions.push(eq(lensTechnologies.id, includeTechnologyId));
	}

	return await db
		.select()
		.from(lensTechnologies)
		.where(and(isNull(lensTechnologies.deletedAt), or(...orConditions)))
		.orderBy(lensTechnologies.name);
}

export async function findLensTechnologyById(id: string): Promise<LensTechnology | null> {
	const [tech] = await db.select().from(lensTechnologies).where(eq(lensTechnologies.id, id));
	return tech ?? null;
}

export async function createLensTechnology(data: NewLensTechnology): Promise<LensTechnology> {
	const now = nowISO();
	const [tech] = await db
		.insert(lensTechnologies)
		.values({ ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
		.returning();
	return tech;
}

export async function updateLensTechnology(
	id: string,
	data: Partial<NewLensTechnology>
): Promise<LensTechnology | null> {
	const [updated] = await db
		.update(lensTechnologies)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(lensTechnologies.id, id))
		.returning();
	return updated ?? null;
}

export async function getAllTechnologies(options?: { search?: string }): Promise<LensTechnology[]> {
	const conditions = [isNull(lensTechnologies.deletedAt)];

	if (options?.search) {
		const searchTerm = `%${options.search.toLowerCase()}%`;
		conditions.push(ilike(lensTechnologies.name, searchTerm));
	}

	return await db
		.select()
		.from(lensTechnologies)
		.where(and(...conditions))
		.orderBy(lensTechnologies.name);
}

export async function deleteLensTechnology(id: string, executor: DbOrTx = db): Promise<boolean> {
	const [updated] = await executor
		.update(lensTechnologies)
		.set({ deletedAt: nowISO(), updatedAt: nowISO() })
		.where(and(eq(lensTechnologies.id, id), isNull(lensTechnologies.deletedAt)))
		.returning({ id: lensTechnologies.id });
	return !!updated;
}

export async function getAllDifferentiators(options?: { search?: string }): Promise<string[]> {
	const diffRows = await db
		.select({ diff: sql<string | null>`unnest(${lensCatalogItems.differentiators})` })
		.from(lensCatalogItems)
		.where(isNull(lensCatalogItems.deletedAt));

	let result = [
		...new Set(
			diffRows.map((row) => row.diff).filter((s): s is string => s !== null && s.length > 0)
		)
	].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

	if (options?.search) {
		const searchLower = options.search.toLowerCase();
		result = result.filter((d) => d.toLowerCase().includes(searchLower));
	}

	return result;
}

export async function renameDifferentiator(oldName: string, newName: string): Promise<void> {
	await db
		.update(lensCatalogItems)
		.set({
			differentiators: sql`array_replace(${lensCatalogItems.differentiators}, ${oldName}, ${newName})`,
			updatedAt: nowISO()
		})
		.where(
			and(
				isNull(lensCatalogItems.deletedAt),
				sql`${oldName} = ANY(${lensCatalogItems.differentiators})`
			)
		);
}

export async function deleteDifferentiator(name: string): Promise<void> {
	await db
		.update(lensCatalogItems)
		.set({
			differentiators: sql`array_remove(${lensCatalogItems.differentiators}, ${name})`,
			updatedAt: nowISO()
		})
		.where(
			and(
				isNull(lensCatalogItems.deletedAt),
				sql`${name} = ANY(${lensCatalogItems.differentiators})`
			)
		);
}

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

/**
 * Extended view of a lens catalog item with resolved relations.
 * `technologyName` is the human-readable name of the lens_technology row
 * (used by the frontend instead of the raw UUID).
 */
export type LensCatalogItemWithRelations = LensCatalogItem & {
	material: { id: string; name: string; code: string; refractiveIndex: number | null } | null;
	supplier: { id: string; name: string } | null;
	/** Resolved name of the digital technology / design — null for finished lenses. */
	technologyName: string | null;
	ranges: LensOpticalRange[];
};

export async function getAllLensCatalogItems(): Promise<LensCatalogItem[]> {
	return await db.select().from(lensCatalogItems).where(isNull(lensCatalogItems.deletedAt));
}

export async function getLensCatalogItemsWithRelations(options?: {
	search?: string;
	source?: LensCatalogSource;
	supplierId?: string;
	materialId?: string;
	type?: LensType;
	/** Filter by technology FK (replaces old free-text filter) */
	technologyId?: string;
	/** Filter by specific differentiator tag */
	differentiator?: string;
}): Promise<LensCatalogItemWithRelations[]> {
	const conditions = [isNull(lensCatalogItems.deletedAt)];

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
	if (options?.technologyId) {
		conditions.push(eq(lensCatalogItems.technologyId, options.technologyId));
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
			supplier: { id: suppliers.id, name: suppliers.name },
			// LEFT JOIN resolves the UUID to a human-readable name for the frontend.
			// NULL when the lens has no digital design (FINISHED source).
			technologyName: lensTechnologies.name
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.leftJoin(lensTechnologies, eq(lensCatalogItems.technologyId, lensTechnologies.id))
		.where(and(...conditions))
		.orderBy(desc(lensCatalogItems.createdAt));

	let items = results.map((r) => ({
		...r.item,
		material: r.material,
		supplier: r.supplier,
		technologyName: r.technologyName ?? null,
		ranges: [] as LensOpticalRange[]
	}));

	// Filter by specific differentiator tag in memory
	if (options?.differentiator) {
		const diffLower = options.differentiator.toLowerCase();
		items = items.filter((item) =>
			item.differentiators?.some((d) => d.toLowerCase() === diffLower)
		);
	}

	// Text search in memory (name, supplier, material, technologyName, source,
	// differentiators, traits, colors)
	if (options?.search) {
		const search = options.search;
		const fields = (item: (typeof items)[number]): string[] =>
			[
				item.name,
				item.supplier?.name,
				item.material?.name,
				item.technologyName,
				item.source,
				getLensSourceLabel(item.source),
				item.source === LensCatalogSource.LAB ? 'tallado' : null,
				...(item.differentiators ?? []),
				item.hasAr ? 'AR' : null,
				...(item.arColors ?? []),
				item.hasBluecut ? 'BLUE' : null,
				item.isPhotochromic ? 'FOTOCROMÁTICO' : null,
				...(item.photochromicColors ?? [])
			].filter((value): value is string => Boolean(value));

		items = items
			.filter((item) => matchesAllTokens(search, fields(item).join(' ')))
			.sort(
				(a, b) =>
					computeRelevanceScore(search, fields(b)) - computeRelevanceScore(search, fields(a))
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
			supplier: { id: suppliers.id, name: suppliers.name },
			technologyName: lensTechnologies.name
		})
		.from(lensCatalogItems)
		.leftJoin(lensMaterials, eq(lensCatalogItems.materialId, lensMaterials.id))
		.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
		.leftJoin(lensTechnologies, eq(lensCatalogItems.technologyId, lensTechnologies.id))
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
		technologyName: result.technologyName ?? null,
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

		let insertedRanges: LensOpticalRange[];
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
			// No range change - fetch current
			insertedRanges = await tx
				.select()
				.from(lensOpticalRanges)
				.where(eq(lensOpticalRanges.lensCatalogItemId, id));
		}

		return { ...updated, ranges: insertedRanges };
	});
}

export async function deleteLensCatalogItem(id: string, executor: DbOrTx = db): Promise<boolean> {
	const [deleted] = await executor
		.update(lensCatalogItems)
		.set({ deletedAt: nowISO(), updatedAt: nowISO() })
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

export async function resolvePendingTechnology(
	pendingName: string,
	supplierId: string | null | undefined,
	now: string,
	executor: DbOrTx = db
): Promise<string> {
	// First, look for an existing global technology with this name
	const [globalTech] = await executor
		.select()
		.from(lensTechnologies)
		.where(
			and(
				ilike(lensTechnologies.name, pendingName),
				isNull(lensTechnologies.supplierId),
				isNull(lensTechnologies.deletedAt)
			)
		);

	if (globalTech) return globalTech.id;

	// Then, look for an existing supplier-specific technology (only if supplierId provided)
	if (supplierId) {
		const [supplierTech] = await executor
			.select()
			.from(lensTechnologies)
			.where(
				and(
					ilike(lensTechnologies.name, pendingName),
					eq(lensTechnologies.supplierId, supplierId),
					isNull(lensTechnologies.deletedAt)
				)
			);

		if (supplierTech) return supplierTech.id;
	}

	// Create a new technology (with or without supplier)
	const [created] = await executor
		.insert(lensTechnologies)
		.values({
			id: crypto.randomUUID(),
			supplierId: supplierId ?? null,
			name: pendingName,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return created.id;
}

/**
 * Retrieve distinct active technologies and unique unnested differentiator tags.
 */
export async function getLensCatalogDistinctValues(): Promise<{
	technologies: { id: string; name: string }[];
	differentiators: string[];
}> {
	const techs = await db
		.select({ id: lensTechnologies.id, name: lensTechnologies.name })
		.from(lensTechnologies)
		.where(isNull(lensTechnologies.deletedAt))
		.orderBy(lensTechnologies.name);

	const diffRows = await db
		.select({ diff: sql<string | null>`unnest(${lensCatalogItems.differentiators})` })
		.from(lensCatalogItems)
		.where(isNull(lensCatalogItems.deletedAt));

	const differentiators = [
		...new Set(diffRows.map((row) => row.diff).filter((s): s is string => s !== null))
	].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

	return {
		technologies: techs,
		differentiators
	};
}
