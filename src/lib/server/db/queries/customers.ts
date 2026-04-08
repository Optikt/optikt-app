import { eq, isNull, isNotNull, and, ilike, asc, desc, type AnyColumn } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import {
	customers,
	prescriptions,
	type Customer,
	type NewCustomer,
	type Prescription,
	type NewPrescription
} from '$lib/server/db/schema';
import type { InferSelectedRow, DbOrTx } from '$lib/server/db/types';

// ============================================================================
// CUSTOMERS
// ============================================================================

/** Sortable customer columns */
export type CustomerOrderBy = 'firstName' | 'lastName' | 'createdAt' | 'updatedAt';

/** Options for querying customers */
export interface GetCustomersOptions {
	/** Include soft-deleted customers in results (default: false) */
	includeDeleted?: boolean;
	/** Column to order by */
	orderBy?: CustomerOrderBy;
	/** Sort direction (default: 'asc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}

/** Query with column projection */
export interface GetCustomersQuery<
	T extends SelectedFields = SelectedFields
> extends GetCustomersOptions {
	columns: T;
}

/** Column map for orderBy */
const ORDER_COLUMNS: Record<CustomerOrderBy, AnyColumn> = {
	firstName: customers.firstName,
	lastName: customers.lastName,
	createdAt: customers.createdAt,
	updatedAt: customers.updatedAt
};

/**
 * Get all customers (excluding soft-deleted by default)
 *
 * @example
 * getAllCustomers()                                                  // → Customer[]
 * getAllCustomers({ orderBy: 'createdAt', limit: 10 })              // → Customer[]
 * getAllCustomers({ columns: { id: customers.id, firstName: customers.firstName } }) // → { id, firstName }[]
 */
export async function getAllCustomers<T extends SelectedFields>(
	query: GetCustomersQuery<T>
): Promise<InferSelectedRow<T>[]>;
export async function getAllCustomers(options?: GetCustomersOptions): Promise<Customer[]>;
export async function getAllCustomers<T extends SelectedFields>(
	optionsOrQuery?: GetCustomersOptions | GetCustomersQuery<T>
): Promise<Customer[] | InferSelectedRow<T>[]> {
	const columns =
		optionsOrQuery && 'columns' in optionsOrQuery ? optionsOrQuery.columns : undefined;
	const opts = optionsOrQuery ?? {};

	// Build WHERE
	const whereClause = opts.includeDeleted ? undefined : isNull(customers.deletedAt);

	// Build ORDER BY
	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy ? orderFn(ORDER_COLUMNS[opts.orderBy]) : undefined;

	// Build query with $dynamic() to allow conditional chaining
	const base = columns
		? db.select(columns).from(customers).$dynamic()
		: db.select().from(customers).$dynamic();

	if (whereClause) base.where(whereClause);
	if (orderClause) base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);
	return await base;
}

/**
 * Find a customer by ID
 * @param deleted - If true, also matches soft-deleted customers (default: false)
 */
export async function findCustomerById(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<Customer | null> {
	const filter = deleted
		? eq(customers.id, id)
		: and(eq(customers.id, id), isNull(customers.deletedAt));
	const [customer] = await db.select().from(customers).where(filter);
	return customer ?? null;
}

/**
 * Find a customer by ID number (cedula, passport, etc.)
 * @param deleted - If true, matches only soft-deleted customers. If false (default), matches only active customers.
 */
export async function findCustomerByIdNumber(
	idNumber: string,
	{ deleted = false }: { deleted?: boolean } = {}
): Promise<Customer | null> {
	const deletedFilter = deleted ? isNotNull(customers.deletedAt) : isNull(customers.deletedAt);
	const [customer] = await db
		.select()
		.from(customers)
		.where(and(eq(customers.idNumber, idNumber), deletedFilter));
	return customer ?? null;
}

/**
 * Search customers by name (first or last name, case-insensitive)
 */
export async function searchCustomersByName(name: string): Promise<Customer[]> {
	const pattern = `%${name}%`;
	return await db
		.select()
		.from(customers)
		.where(
			and(
				isNull(customers.deletedAt),
				// Search in first name or last name
				ilike(customers.firstName, pattern)
			)
		);
}

/**
 * Search customers by phone
 */
export async function searchCustomersByPhone(phone: string): Promise<Customer[]> {
	return await db
		.select()
		.from(customers)
		.where(and(isNull(customers.deletedAt), ilike(customers.primaryPhone, `%${phone}%`)));
}

/**
 * Create a new customer
 */
export async function createCustomer(data: NewCustomer, executor: DbOrTx = db): Promise<Customer> {
	const now = new Date();
	const [customer] = await executor
		.insert(customers)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return customer;
}

/**
 * Resolve an inline customer: normalize ID, check for duplicates, and create.
 * Returns `{ customer }` on success or `{ error }` if a duplicate exists.
 */
export async function resolveInlineCustomer(
	data: {
		firstName: string;
		lastName: string;
		idNumber: string;
		primaryPhone?: string;
		email?: string;
		address?: string;
		notes?: string;
	},
	executor: DbOrTx = db
): Promise<{ customer: Customer; error?: never } | { customer?: never; error: string }> {
	const normalizedIdNumber = data.idNumber.trim().toUpperCase();
	const existing = await findCustomerByIdNumber(normalizedIdNumber);
	if (existing) {
		return { error: 'Ya existe un cliente con ese documento' };
	}
	const customer = await createCustomer(
		{
			firstName: data.firstName,
			lastName: data.lastName,
			idNumber: normalizedIdNumber,
			primaryPhone: data.primaryPhone ?? '',
			email: data.email || null,
			address: data.address || null,
			notes: data.notes ?? null
		},
		executor
	);
	return { customer };
}

/**
 * Update a customer by ID
 */
export async function updateCustomer(
	id: string,
	data: Partial<Omit<Customer, 'id' | 'createdAt'>>
): Promise<Customer | null> {
	const [customer] = await db
		.update(customers)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(customers.id, id))
		.returning();
	return customer ?? null;
}

/**
 * Soft delete a customer by ID
 */
export async function deleteCustomer(id: string): Promise<boolean> {
	const result = await db
		.update(customers)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(customers.id, id));
	return result.count > 0;
}

/**
 * Restore a soft-deleted customer
 */
export async function restoreCustomer(id: string): Promise<Customer | null> {
	const [customer] = await db
		.update(customers)
		.set({ deletedAt: null, updatedAt: new Date() })
		.where(eq(customers.id, id))
		.returning();
	return customer ?? null;
}

// ============================================================================
// PRESCRIPTIONS
// ============================================================================

/**
 * Get all prescriptions for a customer (most recent first)
 */
export async function getCustomerPrescriptions(customerId: string): Promise<Prescription[]> {
	return await db
		.select()
		.from(prescriptions)
		.where(and(eq(prescriptions.customerId, customerId), isNull(prescriptions.deletedAt)))
		.orderBy(desc(prescriptions.prescriptionDate));
}

/**
 * Get the most recent prescription for a customer
 */
export async function getLatestPrescription(customerId: string): Promise<Prescription | null> {
	const [prescription] = await db
		.select()
		.from(prescriptions)
		.where(and(eq(prescriptions.customerId, customerId), isNull(prescriptions.deletedAt)))
		.orderBy(desc(prescriptions.prescriptionDate))
		.limit(1);
	return prescription ?? null;
}

/**
 * Find a prescription by ID
 */
export async function findPrescriptionById(id: string): Promise<Prescription | null> {
	const [prescription] = await db
		.select()
		.from(prescriptions)
		.where(and(eq(prescriptions.id, id), isNull(prescriptions.deletedAt)));
	return prescription ?? null;
}

/**
 * Create a new prescription
 */
export async function createPrescription(
	data: NewPrescription,
	executor: DbOrTx = db
): Promise<Prescription> {
	const now = new Date();
	const [prescription] = await executor
		.insert(prescriptions)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return prescription;
}

/**
 * Update a prescription by ID
 */
export async function updatePrescription(
	id: string,
	data: Partial<Omit<Prescription, 'id' | 'createdAt'>>
): Promise<Prescription | null> {
	const [prescription] = await db
		.update(prescriptions)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(prescriptions.id, id))
		.returning();
	return prescription ?? null;
}

/**
 * Soft delete a prescription by ID
 */
export async function deletePrescription(id: string): Promise<boolean> {
	const result = await db
		.update(prescriptions)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(prescriptions.id, id));
	return result.count > 0;
}
