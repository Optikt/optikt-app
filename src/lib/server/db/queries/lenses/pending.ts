/**
 * Lens queries — pending
 * Split from queries/lenses.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { eq, isNull, and, ilike, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import { lensMaterials, lensCatalogItems, lensTechnologies } from '$lib/server/db/schema';

// ============================================================================
// LENS MATERIALS
// ============================================================================

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
