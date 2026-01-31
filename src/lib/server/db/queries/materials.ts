/**
 * Materials database queries
 */
import { eq, isNull, and, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { materials, type Material } from '$lib/server/db/schema';

/**
 * Get all materials (excluding soft-deleted)
 */
export async function getAllMaterials(): Promise<Material[]> {
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
