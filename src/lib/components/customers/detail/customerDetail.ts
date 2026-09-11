import { parseISODateToLocal } from '$lib/utils';

export interface CustomerNameLike {
	firstName?: string | null;
	lastName?: string | null;
}

export interface CustomerEditData {
	firstName: string;
	lastName: string;
	idNumber: string;
	birthDate: Date | undefined;
	primaryPhone: string;
	email: string;
	address: string;
	notes: string;
}

export function getInitials(customer: CustomerNameLike): string {
	return `${customer.firstName?.charAt(0) ?? ''}${customer.lastName?.charAt(0) ?? ''}`.toUpperCase();
}

export function buildCustomerEditData(customer: {
	firstName?: string | null;
	lastName?: string | null;
	idNumber?: string | null;
	birthDate?: string | null;
	primaryPhone?: string | null;
	email?: string | null;
	address?: string | null;
	notes?: string | null;
}): CustomerEditData {
	return {
		firstName: customer.firstName ?? '',
		lastName: customer.lastName ?? '',
		idNumber: customer.idNumber ?? '',
		birthDate: parseISODateToLocal(customer.birthDate),
		primaryPhone: customer.primaryPhone ?? '',
		email: customer.email ?? '',
		address: customer.address ?? '',
		notes: customer.notes ?? ''
	};
}

export function toggleExpandedId(current: string | null, id: string): string | null {
	return current === id ? null : id;
}

export function findCurrentPrescription<T extends { isCurrent?: boolean | null }>(
	prescriptions: T[]
): T | null {
	return prescriptions.find((p) => p.isCurrent) ?? null;
}
