/**
 * Lens queries — catalog
 * Split from queries/lenses.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { eq, isNull, and, desc, inArray } from 'drizzle-orm';
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
	type LensCatalogItem,
	type NewLensCatalogItem,
	type LensOpticalRange,
	type NewLensOpticalRange
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';

// ============================================================================
// LENS MATERIALS
// ============================================================================

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
