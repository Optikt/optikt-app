/**
 * Materials database queries
 */
import { eq, isNull, and, or, ilike } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { materials, type Material, type NewMaterial } from '$lib/server/db/schema';

/**
 * Get all materials (excluding soft-deleted)
 * @param columns - Optional columns to select (default: all columns)
 */
export async function getAllMaterials(): Promise<Material[]>;
export async function getAllMaterials<T extends SelectedFields>(
	columns: T
): Promise<{ [K in keyof T]: T[K] extends { _: { data: infer D } } ? D : never }[]>;
export async function getAllMaterials<T extends SelectedFields>(columns?: T) {
	if (columns) {
		return await db
			.select(columns)
			.from(materials)
			.where(and(isNull(materials.deletedAt), eq(materials.isActive, true)))
			.orderBy(materials.name);
	}
	return await db
		.select()
		.from(materials)
		.where(and(isNull(materials.deletedAt), eq(materials.isActive, true)))
		.orderBy(materials.name);
}

/**
 * Get materials filtered by product type
 * Includes materials for the specific type AND universal materials (ALL)
 */
export async function getMaterialsByProductType(productType: string): Promise<Material[]> {
	return await db
		.select()
		.from(materials)
		.where(
			and(
				isNull(materials.deletedAt),
				eq(materials.isActive, true),
				or(eq(materials.productType, productType), eq(materials.productType, 'ALL'))
			)
		)
		.orderBy(materials.name);
}

/**
 * Find a material by ID
 */
export async function findMaterialById(id: string): Promise<Material | null> {
	const [material] = await db
		.select()
		.from(materials)
		.where(and(eq(materials.id, id), isNull(materials.deletedAt)));
	return material ?? null;
}

/**
 * Find a material by name and product type (case-insensitive)
 */
export async function findMaterialByName(
	name: string,
	productType?: string
): Promise<Material | null> {
	const conditions = [ilike(materials.name, name), isNull(materials.deletedAt)];

	if (productType) {
		conditions.push(or(eq(materials.productType, productType), eq(materials.productType, 'ALL'))!);
	}

	const [material] = await db
		.select()
		.from(materials)
		.where(and(...conditions));
	return material ?? null;
}

/**
 * Create a new material
 */
export async function createMaterial(
	data: Omit<NewMaterial, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Material> {
	const now = new Date();
	const [material] = await db
		.insert(materials)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return material;
}
