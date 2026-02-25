/**
 * Brands Remote Functions
 * Server-side functions for brand management
 */
import { query, form, command } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	ListBrandsSchema,
	CreateBrandSchema,
	UpdateBrandSchema,
	BrandIdSchema,
	QuickCreateBrandSchema
} from '$lib/schemas/brands';
import {
	getAllBrands,
	findBrandById,
	findBrandByName,
	createBrand,
	updateBrand,
	deleteBrand,
	countProductsByBrand
} from '$lib/server/db/queries/brands';
import type { Brand } from '$lib/server/db/schema';
import { auditService, getAuditContext } from '$lib/server/audit';

// Types for paginated response
export interface PaginatedBrands {
	brands: Brand[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

// Types for delete check
export interface BrandDeleteCheck {
	canDelete: boolean;
	productCount: number;
	brandName: string;
}

/**
 * List brands with pagination and search
 */
export const listBrands = query(ListBrandsSchema, async (data): Promise<PaginatedBrands> => {
	const { page, perPage, search } = data;

	// TODO: Get all brands (we'll filter in memory for now, optimize with SQL later)
	let allBrands = await getAllBrands();

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

	return { brands, total, page, perPage, totalPages };
});

/**
 * Create a new brand with form validation
 */
export const createBrandForm = form(CreateBrandSchema, async (data, issue): Promise<Brand> => {
	const { name, ...rest } = data;

	// Check for duplicate name
	const existing = await findBrandByName(name);
	if (existing) {
		invalid(issue.name('Ya existe una marca con este nombre'));
	}

	// Create brand
	const brand = await createBrand({ name, ...rest });

	// Log the creation
	await auditService.logCreate('brand', brand, getAuditContext());

	return brand;
});

/**
 * Update an existing brand with form validation
 */
export const updateBrandForm = form(UpdateBrandSchema, async (data, issue): Promise<Brand> => {
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
