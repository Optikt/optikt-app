/**
 * Customers Remote Functions
 * Server-side functions for customer management
 */
import { query, form, command } from '$app/server';
import { requireAuth, requireRole, requireAdmin } from '$lib/server/guards';
import { computeRelevanceScore, matchesAllTokens } from '$lib/utils/search';
import { UserRole } from '$lib/shared/enums';
import { invalid } from '@sveltejs/kit';
import {
	ListCustomersSchema,
	CreateCustomerWithPrescriptionSchema,
	UpdateCustomerSchema,
	CustomerIdSchema,
	ReactivateCustomerSchema
} from '$lib/schemas/customers';
import {
	getAllCustomers,
	findCustomerById,
	findCustomerByIdNumber,
	createCustomer,
	createPrescription,
	updateCustomer,
	restoreCustomer
} from '$lib/server/db/queries/customers';
import type { Customer } from '$lib/server/db/schema';
import type { PaginatedResult, CreateEntityResult } from '$lib/types';
import { auditService, getAuditContext } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { softDelete, restore } from '$lib/server/db/queries/deletedItems';
import { toPrescriptionInsert } from '$lib/utils/prescription';

/**
 * List customers with pagination and search
 */
export const listCustomers = query(
	ListCustomersSchema,
	async (data): Promise<PaginatedResult<Customer>> => {
		requireAuth();

		const { page, perPage, search, includeDeleted } = data;

		// Get all customers (active or all including deleted)
		let allCustomers = await getAllCustomers({ includeDeleted });

		// Apply search filter (name, phone, idNumber) with relevance ranking
		if (search) {
			const fields = (customer: Customer): string[] =>
				[
					customer.firstName,
					customer.lastName,
					customer.idNumber,
					customer.primaryPhone,
					customer.email
				].filter((value): value is string => Boolean(value));

			allCustomers = allCustomers
				.filter((customer) => matchesAllTokens(search, fields(customer).join(' ')))
				.sort(
					(a, b) =>
						computeRelevanceScore(search, fields(b)) - computeRelevanceScore(search, fields(a))
				);
		}

		// Calculate pagination
		const total = allCustomers.length;
		const totalPages = Math.ceil(total / perPage);
		const offset = (page - 1) * perPage;
		const customers = allCustomers.slice(offset, offset + perPage);

		return { items: customers, total, page, perPage, totalPages };
	}
);

/**
 * Update an existing customer
 */
export const updateCustomerForm = form(
	UpdateCustomerSchema,
	async (data, issue): Promise<Customer> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

		const { id, idNumber, birthDate, ...rest } = data;

		// Check customer exists
		const existing = await findCustomerById(id);
		if (!existing) {
			invalid('Cliente no encontrado');
			throw new Error('Customer not found');
		}

		// Check for duplicate idNumber if changed
		if (idNumber && idNumber !== existing.idNumber) {
			const existingWithIdNumber = await findCustomerByIdNumber(idNumber);
			if (existingWithIdNumber && existingWithIdNumber.id !== id) {
				invalid(issue.idNumber('Ya existe otro cliente con este número de cédula'));
			}
		}

		const updated = await updateCustomer(id, {
			...rest,
			idNumber: idNumber || null,
			birthDate: birthDate || null
		});

		if (!updated) {
			invalid('Error al actualizar cliente');
			throw new Error('Update failed');
		}

		// Log the update
		await auditService.logUpdate('customer', id, existing, updated, getAuditContext());

		return updated;
	}
);

/**
 * Delete a customer (soft delete)
 */
export const deleteCustomerById = command(CustomerIdSchema, async (data): Promise<boolean> => {
	requireAdmin();

	const existing = await findCustomerById(data.id);
	if (!existing) {
		invalid('Cliente no encontrado');
		return false;
	}

	const success = await db.transaction(async (tx) => {
		return softDelete('customer', data.id, getAuditContext().userId ?? null, tx);
	});
	if (success) {
		// Log the deletion
		await auditService.logDelete('customer', existing, getAuditContext());
	}
	return success;
});

/**
 * Reactivate a soft-deleted customer with updated data
 */
export const reactivateCustomerForm = form(
	ReactivateCustomerSchema,
	async (data): Promise<Customer> => {
		requireAdmin();

		const { id } = data;

		// Check if customer exists and is deleted
		const customer = await restoreCustomer(id);
		await restore('customer', id, db);

		if (!customer) {
			invalid('Cliente no encontrado o no está eliminado');
		}

		// Log the restoration
		await auditService.logRestore('customer', customer, getAuditContext());

		return customer;
	}
);

/**
 * Reactivate a soft-deleted customer with updated data (command version)
 */
export const reactivateCustomer = command(
	ReactivateCustomerSchema,
	async (data): Promise<Customer> => {
		requireAdmin();

		const { id } = data;

		const customer = await restoreCustomer(id);
		await restore('customer', id, db);

		if (!customer) {
			invalid('Cliente no encontrado o no está eliminado');
		}

		// Log the restoration
		await auditService.logRestore('customer', customer, getAuditContext());

		return customer;
	}
);

/**
 * Create a customer with an optional prescription in a single atomic operation.
 * If prescription data is present, both customer and prescription are created
 * inside a transaction (all-or-nothing).
 */
export const createCustomerWithPrescription = form(
	CreateCustomerWithPrescriptionSchema,
	async (data, issue): Promise<CreateEntityResult<Customer>> => {
		requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

		const { prescription, idNumber, birthDate, ...customerFields } = data;
		const context = getAuditContext();

		// Check for duplicate idNumber
		if (idNumber) {
			const existing = await findCustomerByIdNumber(idNumber);
			if (existing) {
				invalid(issue.idNumber('Ya existe un cliente con este número de cédula'));
			}

			const deleted = await findCustomerByIdNumber(idNumber, { deleted: true });
			if (deleted) {
				return {
					success: false,
					message: 'Ya existe un cliente eliminado con este número de cédula. ¿Desea reactivarlo?',
					reactivationCandidate: deleted
				};
			}
		}

		// Create customer + optional prescription in a single transaction
		const result = await db.transaction(async (tx) => {
			const customer = await createCustomer(
				{
					...customerFields,
					idNumber: idNumber || null,
					birthDate: birthDate || null
				},
				tx
			);

			let createdPrescription = null;
			if (prescription) {
				createdPrescription = await createPrescription(
					toPrescriptionInsert(customer.id, {
						...prescription,
						isCurrent: prescription.isCurrent ?? true
					}),
					tx
				);
			}

			return { customer, prescription: createdPrescription };
		});

		// Audit logs - best effort, after transaction
		await auditService.logCreate('customer', result.customer, context);
		if (result.prescription) {
			await auditService.logCreate('prescription', result.prescription, context, {
				excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
			});
		}

		return { success: true, message: 'Cliente creado exitosamente', entity: result.customer };
	}
);
