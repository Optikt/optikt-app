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
	QuickCreateSupplierSchema,
	ReactivateSupplierSchema,
	SupplierTreatmentQuerySchema
} from '$lib/schemas/suppliers';
import {
	getAllSuppliers,
	findSupplierById,
	findSupplierByName,
	findSupplierByRif,
	createSupplier,
	updateSupplier,
	restoreSupplier,
	deleteSupplier
} from '$lib/server/db/queries/suppliers';
import type { Supplier } from '$lib/server/db/schema';
import { auditService, getAuditContext } from '$lib/server/audit';
import { db } from '$lib/server/db';
import {
	getSupplierTreatmentPolicies,
	upsertSupplierTreatmentPolicy,
	deleteSupplierTreatmentPolicy
} from '$lib/server/db/queries/supplierTreatmentPolicies';
import { LensTreatmentAvailability } from '$lib/shared/contracts/lenses';

// Types for paginated response
export interface PaginatedSuppliers {
	suppliers: Supplier[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

// Types for create result
export interface CreateSupplierResult {
	success: boolean;
	message: string;
	supplier?: Supplier;
	reactivationCandidate?: Supplier;
}

/**
 * List suppliers with pagination, search, and type filter
 */
export const listSuppliers = query(
	ListSuppliersSchema,
	async (data): Promise<PaginatedSuppliers> => {
		const { page, perPage, search, type, includeDeleted } = data;

		// Get suppliers (active only or all if includeDeleted)
		let allSuppliers = await getAllSuppliers({ includeDeleted });

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
 * Returns either a success with supplier, or a reactivation candidate for confirmation
 */
export const createSupplierForm = form(
	CreateSupplierSchema,
	async (data, issue): Promise<CreateSupplierResult> => {
		const { name, rif, treatmentPolicies, ...rest } = data;

		// Check for duplicate ACTIVE name
		const existingActive = await findSupplierByName(name);
		if (existingActive) {
			invalid(issue.name('Ya existe un proveedor con este nombre'));
		}

		// Check for duplicate ACTIVE RIF if provided
		if (rif && rif.trim() !== '') {
			const existingRif = await findSupplierByRif(rif);
			if (existingRif) {
				invalid(issue.rif('Ya existe un proveedor con este RIF'));
			}
		}

		// Check for DELETED supplier with same name (reactivation candidate)
		const deletedSupplier = await findSupplierByName(name, { deleted: true });
		if (deletedSupplier) {
			// Can reactivate! Return candidate for confirmation
			return {
				success: false,
				reactivationCandidate: deletedSupplier,
				message:
					'El nombre del proveedor pertenece a un proveedor eliminado. ¿Desea reactivarlo con los nuevos datos?'
			};
		}

		// Create supplier + save treatment policies in a single transaction
		const supplier = await db.transaction(async (tx) => {
			const sup = await createSupplier(
				{ name, rif: rif && rif.trim() !== '' ? rif : null, ...rest },
				tx
			);
			await saveTreatmentPoliciesInTx(sup.id, treatmentPolicies, tx);
			return sup;
		});

		// Audit logs (best-effort, after transaction)
		await auditService.logCreate('supplier', supplier, getAuditContext());
		const newPolicies = await getSupplierTreatmentPolicies(supplier.id);
		if (newPolicies.length > 0) {
			await auditService.logCreate(
				'supplier_treatment_policy',
				{ id: supplier.id, policies: newPolicies },
				getAuditContext()
			);
		}

		return { success: true, message: 'Proveedor creado exitosamente', supplier };
	}
);

/**
 * Update an existing supplier with form validation
 */
export const updateSupplierForm = form(
	UpdateSupplierSchema,
	async (data, issue): Promise<Supplier> => {
		const { id, name, rif, treatmentPolicies, ...rest } = data;

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

		// Read existing treatment policies before update (for audit diff)
		const existingPolicies = await getSupplierTreatmentPolicies(id);

		// Update supplier + save treatment policies in a single transaction
		const updated = await db.transaction(async (tx) => {
			const sup = await updateSupplier(
				id,
				{ name, rif: rif && rif.trim() !== '' ? rif : null, ...rest },
				tx
			);
			if (!sup) {
				throw new Error('Error actualizando proveedor');
			}
			if (treatmentPolicies) {
				await saveTreatmentPoliciesInTx(id, treatmentPolicies, tx);
			}
			return sup;
		});

		// Audit logs (best-effort, after transaction)
		await auditService.logUpdate('supplier', id, existing, updated, getAuditContext());
		if (treatmentPolicies) {
			const newPolicies = await getSupplierTreatmentPolicies(id);
			await auditService.logUpdate(
				'supplier_treatment_policy',
				id,
				{ policies: existingPolicies },
				{ policies: newPolicies },
				getAuditContext()
			);
		}

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

/**
 * Reactivate a deleted supplier with new data
 */
export const reactivateSupplier = command(
	ReactivateSupplierSchema,
	async (data): Promise<Supplier> => {
		const { deletedSupplierId } = data;

		// Verify the supplier exists and is deleted
		const existing = await findSupplierById(deletedSupplierId, { deleted: true });
		if (!existing || !existing.deletedAt) {
			throw new Error('Proveedor eliminado no encontrado');
		}

		// Restore the supplier (reactivation)
		const restored = await restoreSupplier(deletedSupplierId);

		// Log the reactivation
		await auditService.logCreate('supplier', restored, getAuditContext());

		return restored;
	}
);

// ============================================================================
// SUPPLIER TREATMENT DEFAULTS
// ============================================================================

/** Internal helper — saves treatment policies inside an existing transaction */
async function saveTreatmentPoliciesInTx(
	supplierId: string,
	policies: {
		code: string;
		availability: string;
		additionalPrice?: number;
		requiresConfirmation?: boolean;
	}[],
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
) {
	for (const policy of policies) {
		if (policy.availability === LensTreatmentAvailability.NOT_AVAILABLE) {
			await deleteSupplierTreatmentPolicy(supplierId, policy.code, tx);
		} else {
			await upsertSupplierTreatmentPolicy(
				{
					supplierId,
					code: policy.code,
					availability: policy.availability,
					additionalPrice: policy.additionalPrice ?? 0,
					requiresConfirmation: policy.requiresConfirmation ?? false
				},
				tx
			);
		}
	}
}

/**
 * Get treatment policy defaults for a supplier
 */
export const getSupplierTreatmentDefaults = query(SupplierTreatmentQuerySchema, async (data) => {
	return getSupplierTreatmentPolicies(data.supplierId);
});
