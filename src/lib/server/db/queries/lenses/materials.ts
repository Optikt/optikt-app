/**
 * Lens queries — materials
 * Split from queries/lenses.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { eq, isNull, and, ilike } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import { lensMaterials, type LensMaterial, type NewLensMaterial } from '$lib/server/db/schema';
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
