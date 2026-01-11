import { eq, isNull, and, ilike, desc, not } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	customers,
	prescriptions,
	type Customer,
	type NewCustomer,
	type Prescription,
	type NewPrescription
} from '$lib/server/db/schema';

// ============================================================================
// CUSTOMERS
// ============================================================================

/**
 * Get all customers (excluding soft-deleted)
 */
export async function getAllCustomers(): Promise<Customer[]> {
	return await db.select().from(customers).where(isNull(customers.deletedAt));
}

/**
 * Find a customer by ID
 */
export async function findCustomerById(id: string): Promise<Customer | null> {
	const [customer] = await db
		.select()
		.from(customers)
		.where(and(eq(customers.id, id), isNull(customers.deletedAt)));
	return customer ?? null;
}

/**
 * Find a customer by ID number (cedula, passport, etc.)
 */
export async function findCustomerByIdNumber(idNumber: string): Promise<Customer | null> {
	const [customer] = await db
		.select()
		.from(customers)
		.where(and(eq(customers.idNumber, idNumber), isNull(customers.deletedAt)));
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
export async function createCustomer(data: NewCustomer): Promise<Customer> {
	const now = new Date();
	const [customer] = await db
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
 * Find a soft-deleted customer by ID number (for reactivation)
 */
export async function findDeletedCustomerByIdNumber(idNumber: string): Promise<Customer | null> {
	const [customer] = await db
		.select()
		.from(customers)
		.where(and(eq(customers.idNumber, idNumber), not(isNull(customers.deletedAt))));
	return customer ?? null;
}

/**
 * Restore a soft-deleted customer
 */
export async function restoreCustomer(
	id: string,
	data?: Partial<Omit<Customer, 'id' | 'createdAt' | 'deletedAt'>>
): Promise<Customer | null> {
	const [customer] = await db
		.update(customers)
		.set({ ...data, deletedAt: null, updatedAt: new Date() })
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
export async function createPrescription(data: NewPrescription): Promise<Prescription> {
	const now = new Date();
	const [prescription] = await db
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
