/**
 * Suppliers Remote Functions
 * Server-side functions for supplier management
 */
import { query, form, command } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	ListSuppliersSchema,
	CreateSupplierSchema,
	UpdateSupplierSchema,
	SupplierIdSchema,
	QuickCreateSupplierSchema
} from '$lib/schemas/suppliers';
import {
	getAllSuppliers,
	findSupplierById,
	findSupplierByName,
	findSupplierByRif,
	createSupplier,
	updateSupplier,
	deleteSupplier
} from '$lib/server/db/queries/suppliers';
import type { Supplier } from '$lib/server/db/schema';
import { auditService, getAuditContext } from '$lib/server/audit';

// Types for paginated response
export interface PaginatedSuppliers {
	suppliers: Supplier[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

/**
 * List suppliers with pagination, search, and type filter
 */
export const listSuppliers = query(
	ListSuppliersSchema,
	async (data): Promise<PaginatedSuppliers> => {
		const { page, perPage, search, type } = data;

		// Get all suppliers (we'll filter in memory for now)
		let allSuppliers = await getAllSuppliers();

		// Apply search filter
		if (search) {
			const searchLower = search.toLowerCase();
			allSuppliers = allSuppliers.filter(
				(supplier) =>
					supplier.name.toLowerCase().includes(searchLower) ||
					supplier.rif?.toLowerCase().includes(searchLower) ||
					supplier.primaryPhone?.includes(search)
			);
		}

		// Apply type filter
		if (type) {
			allSuppliers = allSuppliers.filter((s) => s.type === type);
		}

		// Calculate pagination
		const total = allSuppliers.length;
		const totalPages = Math.ceil(total / perPage);
		const offset = (page - 1) * perPage;
		const suppliers = allSuppliers.slice(offset, offset + perPage);

		return { suppliers, total, page, perPage, totalPages };
	}
);

/**
 * Create a new supplier with form validation
 */
export const createSupplierForm = form(
	CreateSupplierSchema,
	async (data, issue): Promise<Supplier> => {
		const { name, rif, ...rest } = data;

		// Check for duplicate name
		const existingName = await findSupplierByName(name);
		if (existingName) {
			invalid(issue.name('Ya existe un proveedor con este nombre'));
		}

		// Check for duplicate RIF if provided
		if (rif && rif.trim() !== '') {
			const existingRif = await findSupplierByRif(rif);
			if (existingRif) {
				invalid(issue.rif('Ya existe un proveedor con este RIF'));
			}
		}

		// Create supplier
		const supplier = await createSupplier({
			name,
			rif: rif && rif.trim() !== '' ? rif : null,
			...rest
		});

		// Log audit
		await auditService.logCreate('supplier', supplier, getAuditContext());

		return supplier;
	}
);

/**
 * Update an existing supplier with form validation
 */
export const updateSupplierForm = form(
	UpdateSupplierSchema,
	async (data, issue): Promise<Supplier> => {
		const { id, name, rif, ...rest } = data;

		// Check if supplier exists
		const existing = await findSupplierById(id);
		if (!existing) {
			invalid('Proveedor no encontrado');
		}

		// Check for duplicate name if name is being changed
		if (name && name !== existing.name) {
			const duplicate = await findSupplierByName(name);
			if (duplicate) {
				invalid(issue.name('Ya existe un proveedor con este nombre'));
			}
		}

		// Check for duplicate RIF if RIF is being changed
		if (rif && rif.trim() !== '' && rif !== existing.rif) {
			const duplicate = await findSupplierByRif(rif);
			if (duplicate) {
				invalid(issue.rif('Ya existe un proveedor con este RIF'));
			}
		}

		// Update supplier
		const updated = await updateSupplier(id, {
			name,
			rif: rif && rif.trim() !== '' ? rif : null,
			...rest
		});
		if (!updated) {
			invalid('Error actualizando proveedor');
		}

		// Log audit
		await auditService.logUpdate('supplier', id, existing, updated, getAuditContext());

		return updated;
	}
);

/**
 * Delete a supplier (soft delete)
 */
export const deleteSupplierById = command(SupplierIdSchema, async (data): Promise<void> => {
	const { id } = data;

	const existing = await findSupplierById(id);
	if (!existing) {
		throw new Error('Proveedor no encontrado');
	}

	await deleteSupplier(id);

	// Log audit
	await auditService.logDelete('supplier', existing, getAuditContext());
});

/**
 * Quick create a supplier with minimal info (for inline creation in forms)
 * Uses defaults for required fields, user can complete later
 */
export const quickCreateSupplier = command(
	QuickCreateSupplierSchema,
	async (data): Promise<{ id: string; name: string }> => {
		const { name } = data;

		// Check for duplicate
		const existing = await findSupplierByName(name);
		if (existing) {
			// Return existing instead of throwing error
			return { id: existing.id, name: existing.name };
		}

		const supplier = await createSupplier({
			name,
			type: 'DISTRIBUTOR',
			primaryPhone: '0000-0000000'
		});

		// Log audit
		await auditService.logCreate('supplier', supplier, getAuditContext());

		return { id: supplier.id, name: supplier.name };
	}
);
