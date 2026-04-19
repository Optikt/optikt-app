/**
 * Brands Remote Functions
 * Server-side functions for brand management
 */
import { query, form, command } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';
import { invalid } from '@sveltejs/kit';
import {
	ListBrandsSchema,
	CreateBrandSchema,
	UpdateBrandSchema,
	BrandIdSchema,
	QuickCreateBrandSchema,
	ReactivateBrandSchema
} from '$lib/schemas/brands';
import {
	getAllBrands,
	findBrandById,
	findBrandByName,
	createBrand,
	updateBrand,
	restoreBrand,
	deleteBrand,
	countProductsByBrand
} from '$lib/server/db/queries/brands';
import type { Brand } from '$lib/server/db/schema';
import type { PaginatedResult, CreateEntityResult } from '$lib/types';
import { auditService, getAuditContext } from '$lib/server/audit';

// Types for delete check
export interface BrandDeleteCheck {
	canDelete: boolean;
	productCount: number;
	brandName: string;
}

/**
 * List brands with pagination and search
 */
export const listBrands = query(ListBrandsSchema, async (data): Promise<PaginatedResult<Brand>> => {
	requireAuth();

	const { page, perPage, search, includeDeleted } = data;

	// Get brands from DB (single query handles the includeDeleted filter)
	let allBrands = await getAllBrands({ includeDeleted });

	// Apply search filter
	if (search) {
		const searchLower = search.toLowerCase();
		allBrands = allBrands.filter(
			(brand) =>
				brand.name.toLowerCase().includes(searchLower) ||
				brand.country?.toLowerCase().includes(searchLower)
		);
	}

	// Calculate pagination
	const total = allBrands.length;
	const totalPages = Math.ceil(total / perPage);
	const offset = (page - 1) * perPage;
	const brands = allBrands.slice(offset, offset + perPage);

	return { items: brands, total, page, perPage, totalPages };
});

/**
 * Create a new brand with form validation
 * Returns either a success with brand, or a reactivation candidate for confirmation
 */
export const createBrandForm = form(
	CreateBrandSchema,
	async (data, issue): Promise<CreateEntityResult<Brand>> => {
		requireAdmin();

		const { name, ...rest } = data;

		// Check for duplicate ACTIVE name
		const existingActive = await findBrandByName(name);
		if (existingActive) {
			invalid(issue.name('Ya existe una marca con este nombre'));
		}

		// Check for DELETED brand with same name (reactivation candidate)
		const deletedBrand = await findBrandByName(name, { deleted: true });
		if (deletedBrand) {
			// Can reactivate! Return candidate for confirmation
			return {
				success: false,
				reactivationCandidate: deletedBrand,
				message:
					'El nombre de la marca pertenece a una marca eliminada. ¿Desea reactivarla con los nuevos datos?'
			};
		}

		// All clear - create new brand
		const brand = await createBrand({ name, ...rest });

		// Log the creation
		await auditService.logCreate('brand', brand, getAuditContext());

		return { success: true, message: 'Marca creada exitosamente', entity: brand };
	}
);

/**
 * Update an existing brand with form validation
 */
export const updateBrandForm = form(UpdateBrandSchema, async (data, issue): Promise<Brand> => {
	requireAdmin();

	const { id, name, ...rest } = data;

	// Check if brand exists
	const existing = await findBrandById(id);
	if (!existing) {
		invalid('Marca no encontrada');
	}

	// Check for duplicate name if name is being changed
	if (name && name !== existing.name) {
		const duplicate = await findBrandByName(name);
		if (duplicate) {
			invalid(issue.name('Ya existe una marca con este nombre'));
		}
	}

	// Update brand
	const updated = await updateBrand(id, { name, ...rest });
	if (!updated) {
		invalid('Error actualizando marca');
	}

	// Log the update
	await auditService.logUpdate('brand', id, existing, updated, getAuditContext());

	return updated;
});

/**
 * Delete a brand (soft delete)
 */
export const deleteBrandById = command(BrandIdSchema, async (data): Promise<void> => {
	requireAdmin();

	const { id } = data;

	const existing = await findBrandById(id);
	if (!existing) {
		throw new Error('Marca no encontrada');
	}

	await deleteBrand(id);

	// Log the deletion
	await auditService.logDelete('brand', existing, getAuditContext());
});

/**
 * Check if a brand can be safely deleted
 * Returns product count for confirmation modal
 */
export const checkBrandCanDelete = query(BrandIdSchema, async (data): Promise<BrandDeleteCheck> => {
	requireAuth();

	const { id } = data;

	const brand = await findBrandById(id);
	if (!brand) {
		throw new Error('Marca no encontrada');
	}

	const productCount = await countProductsByBrand(id);

	return {
		canDelete: productCount === 0,
		productCount,
		brandName: brand.name
	};
});

/**
 * Quick create a brand with minimal info (for inline creation in forms)
 * Returns only the id and name for the select component
 */
export const quickCreateBrand = command(
	QuickCreateBrandSchema,
	async (data): Promise<{ id: string; name: string }> => {
		requireAdmin();

		const { name } = data;

		// Check for duplicate
		const existing = await findBrandByName(name);
		if (existing) {
			// Return existing instead of throwing error
			return { id: existing.id, name: existing.name };
		}

		const brand = await createBrand({ name });

		// Log the creation
		await auditService.logCreate('brand', brand, getAuditContext());

		return { id: brand.id, name: brand.name };
	}
);

/**
 * Reactivate a deleted brand with new data
 */
export const reactivateBrand = command(ReactivateBrandSchema, async (data): Promise<Brand> => {
	requireAdmin();

	const { deletedBrandId } = data;

	// Verify the brand exists and is deleted
	const existing = await findBrandById(deletedBrandId, { deleted: true });
	if (!existing || !existing.deletedAt) {
		throw new Error('Marca eliminada no encontrada');
	}

	// Restore the brand (reactivation)
	const restored = await restoreBrand(deletedBrandId);

	// Log the reactivation
	await auditService.logCreate('brand', restored, getAuditContext());

	return restored;
});
