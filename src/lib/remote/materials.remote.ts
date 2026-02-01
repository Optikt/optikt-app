/**
 * Materials Remote Functions
 * Server-side functions for unified materials management
 */
import { query, command } from '$app/server';
import { QuickCreateMaterialSchema, ListMaterialsSchema } from '$lib/schemas/materials';
import { eq, ilike, and, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { materials, type Material } from '$lib/server/db/schema';

/**
 * List all active materials, optionally filtered by product type
 */
export const listMaterials = query(ListMaterialsSchema, async (params): Promise<Material[]> => {
	const { includeDeleted, productType } = params;

	const conditions = [];

	if (!includeDeleted) {
		conditions.push(isNull(materials.deletedAt));
	}

	conditions.push(eq(materials.isActive, true));

	if (productType) {
		// Include materials for the specific type AND universal materials (ALL)
		conditions.push(or(eq(materials.productType, productType), eq(materials.productType, 'ALL')));
	}

	return await db
		.select()
		.from(materials)
		.where(and(...conditions))
		.orderBy(materials.name);
});

/**
 * Find a material by name and product type (case-insensitive)
 */
async function findMaterialByNameAndType(
	name: string,
	productType: string
): Promise<Material | null> {
	const [material] = await db
		.select()
		.from(materials)
		.where(
			and(
				ilike(materials.name, name),
				eq(materials.productType, productType),
				isNull(materials.deletedAt)
			)
		);
	return material ?? null;
}

/**
 * Generate a unique code from material name and product type
 */
function generateMaterialCode(name: string, productType: string): string {
	const prefix = productType.slice(0, 2).toUpperCase();
	const nameCode = name
		.toUpperCase()
		.replace(/\s+/g, '_')
		.replace(/[^A-Z0-9_]/g, '')
		.slice(0, 10);
	return `${prefix}_${nameCode}`;
}

/**
 * Quick create a material with minimal info (for inline creation in forms)
 * Code is auto-generated from name
 */
export const quickCreateMaterial = command(
	QuickCreateMaterialSchema,
	async (data): Promise<{ id: string; name: string; productType: string }> => {
		const { name, productType = 'FRAME' } = data;

		// Check for duplicate (same name + productType)
		const existing = await findMaterialByNameAndType(name, productType);
		if (existing) {
			// Return existing instead of throwing error
			return {
				id: existing.id,
				name: existing.name,
				productType: existing.productType ?? 'FRAME'
			};
		}

		const code = generateMaterialCode(name, productType);

		const [material] = await db
			.insert(materials)
			.values({
				name,
				code,
				productType,
				isActive: true
			})
			.returning();

		return { id: material.id, name: material.name, productType: material.productType };
	}
);
