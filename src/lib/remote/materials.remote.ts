/**
 * Materials Remote Functions
 * Server-side functions for unified materials management
 */
import { query, form, command } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	ListMaterialsSchema,
	MaterialIdSchema,
	CreateMaterialSchema,
	UpdateMaterialSchema,
	QuickCreateMaterialSchema,
	ReactivateMaterialSchema
} from '$lib/schemas/materials';
import {
	getAllMaterials,
	countMaterials,
	findMaterialById,
	findMaterialByName,
	createMaterial,
	updateMaterial,
	restoreMaterial,
	deleteMaterial
} from '$lib/server/db/queries/materials';
import type { Material } from '$lib/server/db/schema';
import { auditService, getAuditContext } from '$lib/server/audit';

// Types for paginated response
export interface PaginatedMaterials {
	materials: Material[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

// Types for create result
export interface CreateMaterialResult {
	success: boolean;
	message: string;
	material?: Material;
	reactivationCandidate?: Material;
}

/**
 * List all materials, optionally including deleted ones
 */
export const listMaterials = query(
	ListMaterialsSchema,
	async (params): Promise<PaginatedMaterials> => {
		const { page, perPage, search, includeDeleted, productType } = params;
		const offset = (page - 1) * perPage;

		const filterOpts = { search, productType, includeDeleted };

		const [materialList, total] = await Promise.all([
			getAllMaterials({
				...filterOpts,
				orderBy: 'name',
				limit: perPage,
				offset
			}),
			countMaterials(filterOpts)
		]);

		return {
			materials: materialList,
			total,
			page,
			perPage,
			totalPages: Math.ceil(total / perPage)
		};
	}
);

/**
 * Find a material by ID
 */
export const getMaterialById = query(MaterialIdSchema, async (data): Promise<Material | null> => {
	const { id } = data;
	const material = await findMaterialById(id);
	if (!material) {
		throw new Error('Material no encontrado');
	}
	return material;
});

/**
 * Create a new material with form validation
 * Returns either a success with material, or a reactivation candidate for confirmation
 */
export const createMaterialForm = form(
	CreateMaterialSchema,
	async (data, issue): Promise<CreateMaterialResult> => {
		const { name, code, productType, description } = data;

		// Check for duplicate ACTIVE name + productType
		const existingActive = await findMaterialByName(name, productType);
		if (existingActive) {
			invalid(issue.name('Ya existe un material con este nombre y tipo'));
		}

		// Check for DELETED material with same name and productType (reactivation candidate)
		const deletedMaterial = await findMaterialByName(name, productType, { deleted: 'only' });
		if (deletedMaterial) {
			// Can reactivate! Return candidate for confirmation
			return {
				success: false,
				reactivationCandidate: deletedMaterial,
				message:
					'El nombre del material pertenece a un material eliminado. ¿Desea reactivarlo con los nuevos datos?'
			};
		}

		// All clear - create new material
		const material = await createMaterial({
			name,
			code,
			productType,
			description: description ?? null,
			isActive: true
		});

		// Log the creation
		await auditService.logCreate('material', material, getAuditContext());

		return { success: true, material, message: 'Material creado exitosamente' };
	}
);

/**
 * Update an existing material with form validation
 */
export const updateMaterialForm = form(
	UpdateMaterialSchema,
	async (data, issue): Promise<Material> => {
		const { id, name, code, productType, description } = data;

		// Check if material exists
		const existing = await findMaterialById(id);
		if (!existing) {
			invalid('Material no encontrado');
		}

		// Check for duplicate name + productType if being changed
		if (name && name !== existing.name) {
			const duplicate = await findMaterialByName(name, productType ?? existing.productType);
			if (duplicate) {
				invalid(issue.name('Ya existe un material con este nombre y tipo'));
			}
		}

		// Update material
		const updated = await updateMaterial(id, {
			name,
			code,
			productType,
			description: description ?? null
		});
		if (!updated) {
			invalid('Error actualizando material');
		}

		// Log the update
		await auditService.logUpdate('material', id, existing, updated, getAuditContext());

		return updated;
	}
);

/**
 * Delete a material (soft delete)
 */
export const deleteMaterialById = command(MaterialIdSchema, async (data): Promise<void> => {
	const { id } = data;

	const existing = await findMaterialById(id);
	if (!existing) {
		throw new Error('Material no encontrado');
	}

	await deleteMaterial(id);

	// Log the deletion
	await auditService.logDelete('material', existing, getAuditContext());
});

/**
 * Quick create a material with minimal info (for inline creation in forms)
 * Code is auto-generated from name
 */
export const quickCreateMaterial = command(
	QuickCreateMaterialSchema,
	async (data): Promise<{ id: string; name: string; productType: string }> => {
		const { name, productType = 'FRAME' } = data;

		// Check for duplicate (same name + productType)
		const existing = await findMaterialByName(name, productType);
		if (existing) {
			// Return existing instead of throwing error
			return {
				id: existing.id,
				name: existing.name,
				productType: existing.productType ?? 'FRAME'
			};
		}

		// Generate code from name
		const prefix = productType.slice(0, 2).toUpperCase();
		const nameCode = name
			.toUpperCase()
			.replace(/\s+/g, '_')
			.replace(/[^A-Z0-9_]/g, '')
			.slice(0, 10);
		const code = `${prefix}_${nameCode}`;

		const material = await createMaterial({
			name,
			code,
			productType,
			isActive: true
		});

		// Log the creation
		await auditService.logCreate('material', material, getAuditContext());

		return { id: material.id, name: material.name, productType: material.productType };
	}
);

/**
 * Reactivate a deleted material with new data
 */
export const reactivateMaterial = command(
	ReactivateMaterialSchema,
	async (data): Promise<Material> => {
		const { deletedMaterialId } = data;

		// Verify the material exists and is deleted
		const material = await findMaterialById(deletedMaterialId, { deleted: 'include' });
		if (!material || !material.deletedAt) {
			throw new Error('Material eliminado no encontrado');
		}

		// Restore the material (reactivation)
		const restored = await restoreMaterial(deletedMaterialId);

		// Log the reactivation
		await auditService.logCreate('material', restored, getAuditContext());

		return restored;
	}
);
