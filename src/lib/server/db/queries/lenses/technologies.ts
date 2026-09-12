/**
 * Lens queries — technologies
 * Split from queries/lenses.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { eq, isNull, and, or, ilike, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import {
	lensCatalogItems,
	lensTechnologies,
	type LensTechnology,
	type NewLensTechnology
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';

// ============================================================================
// LENS MATERIALS
// ============================================================================

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
