/**
 * Materials Remote Functions
 * Server-side functions for lens materials management
 */
import { query, command } from '$app/server';
import { QuickCreateMaterialSchema, ListMaterialsSchema } from '$lib/schemas/materials';
import { getAllLensMaterials, createLensMaterial } from '$lib/server/db/queries/lenses';
import { ilike, and, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lensMaterials, type LensMaterial } from '$lib/server/db/schema';

/**
 * List all active materials
 */
export const listMaterials = query(ListMaterialsSchema, async (): Promise<LensMaterial[]> => {
	return await getAllLensMaterials();
});

/**
 * Find a material by name (case-insensitive)
 */
async function findMaterialByName(name: string): Promise<LensMaterial | null> {
	const [material] = await db
		.select()
		.from(lensMaterials)
		.where(and(ilike(lensMaterials.name, name), isNull(lensMaterials.deletedAt)));
	return material ?? null;
}

/**
 * Generate a unique code from material name
 */
function generateMaterialCode(name: string): string {
	return name
		.toUpperCase()
		.replace(/\s+/g, '_')
		.replace(/[^A-Z0-9_]/g, '')
		.slice(0, 10);
}

/**
 * Quick create a material with minimal info (for inline creation in forms)
 * Code is auto-generated from name
 */
export const quickCreateMaterial = command(
	QuickCreateMaterialSchema,
	async (data): Promise<{ id: string; name: string }> => {
		const { name } = data;

		// Check for duplicate
		const existing = await findMaterialByName(name);
		if (existing) {
			throw new Error('Ya existe un material con este nombre');
		}

		const code = generateMaterialCode(name);

		const material = await createLensMaterial({
			name,
			code,
			isActive: true
		});
		return { id: material.id, name: material.name };
	}
);
