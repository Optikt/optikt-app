/**
 * Customers Remote Functions
 * Server-side functions for customer management
 */
import { query, form, command, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import {
	ListCustomersSchema,
	CreateCustomerSchema,
	UpdateCustomerSchema,
	CustomerIdSchema,
	ReactivateCustomerSchema
} from '$lib/schemas/customers';
import {
	getAllCustomers,
	findCustomerById,
	findCustomerByIdNumber,
	findDeletedCustomerByIdNumber,
	createCustomer,
	updateCustomer,
	deleteCustomer,
	restoreCustomer
} from '$lib/server/db/queries/customers';
import type { Customer } from '$lib/server/db/schema';
import { auditService, type AuditContext } from '$lib/server/audit';

/**
 * Helper to build audit context from the request event
 */
function getAuditContext(): AuditContext {
	const event = getRequestEvent();
	return {
		userId: event.locals.user?.id ?? null,
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

// Types for paginated response
export interface PaginatedCustomers {
	customers: Customer[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

// Type for create result with potential reactivation candidate
export interface CreateCustomerResult {
	success: boolean;
	customer?: Customer;
	reactivationCandidate?: Customer;
}

/**
 * List customers with pagination and search
 */
export const listCustomers = query(
	ListCustomersSchema,
	async (data): Promise<PaginatedCustomers> => {
		const { page, perPage, search } = data;

		// Get all customers (we'll filter in memory for now)
		let allCustomers = await getAllCustomers();

		// Apply search filter (name, phone, idNumber)
		if (search) {
			const searchLower = search.toLowerCase();
			allCustomers = allCustomers.filter(
				(customer) =>
					customer.firstName.toLowerCase().includes(searchLower) ||
					customer.lastName.toLowerCase().includes(searchLower) ||
					customer.idNumber?.toLowerCase().includes(searchLower) ||
					customer.primaryPhone?.includes(search) ||
					customer.email?.toLowerCase().includes(searchLower)
			);
		}

		// Calculate pagination
		const total = allCustomers.length;
		const totalPages = Math.ceil(total / perPage);
		const offset = (page - 1) * perPage;
		const customers = allCustomers.slice(offset, offset + perPage);

		return { customers, total, page, perPage, totalPages };
	}
);

/**
 * Create a new customer with form validation
 */
export const createCustomerForm = form(
	CreateCustomerSchema,
	async (data, issue): Promise<CreateCustomerResult> => {
		const { idNumber, birthDate, ...rest } = data;

		// Check for duplicate idNumber if provided
		if (idNumber) {
			const existingCustomer = await findCustomerByIdNumber(idNumber);
			if (existingCustomer) {
				invalid(issue.idNumber('Ya existe un cliente con este número de cédula'));
			}

			// Check for deleted customer with same idNumber (for reactivation)
			const deletedCustomer = await findDeletedCustomerByIdNumber(idNumber);
			if (deletedCustomer) {
				return {
					success: false,
					reactivationCandidate: deletedCustomer
				};
			}
		}

		const customer = await createCustomer({
			...rest,
			idNumber: idNumber || null,
			birthDate: birthDate ? new Date(birthDate) : null
		});

		// Log the creation
		await auditService.logCreate('customer', customer, getAuditContext());

		return { success: true, customer };
	}
);

/**
 * Update an existing customer
 */
export const updateCustomerForm = form(
	UpdateCustomerSchema,
	async (data, issue): Promise<Customer> => {
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
			birthDate: birthDate ? new Date(birthDate) : null
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
	const existing = await findCustomerById(data.id);
	if (!existing) {
		invalid('Cliente no encontrado');
		return false;
	}

	const success = await deleteCustomer(data.id);
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
		const { id, birthDate, ...rest } = data;

		// Check if customer exists and is deleted
		const customer = await restoreCustomer(id, {
			...rest,
			birthDate: birthDate ? new Date(birthDate) : null
		});

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
		const { id, birthDate, ...rest } = data;

		const customer = await restoreCustomer(id, {
			...rest,
			birthDate: birthDate ? new Date(birthDate) : null
		});

		if (!customer) {
			invalid('Cliente no encontrado o no está eliminado');
			throw new Error('Customer not found');
		}

		// Log the restoration
		await auditService.logRestore('customer', customer, getAuditContext());

		return customer;
	}
);
