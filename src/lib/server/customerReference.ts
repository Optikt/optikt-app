import {
	findCustomerById,
	findCustomerByIdNumber,
	createCustomer
} from '$lib/server/db/queries/customers';
import { normalizeIdNumber } from '$lib/utils';
import type { DbOrTx } from '$lib/server/db/types';
import type { Customer } from '$lib/server/db/schema';

export interface InlineCustomerInput {
	firstName: string;
	lastName: string;
	idNumber: string;
	primaryPhone?: string;
	email?: string;
	address?: string;
	notes?: string;
}

/** Validate the customer reference (existing id or inline new customer) before the transaction. */
export async function resolveCustomerReference(data: {
	customerId?: string;
	newCustomer?: InlineCustomerInput;
}): Promise<{ customerId: string | null } | { error: string }> {
	let existingCustomerId: string | null = null;

	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { error: 'Cliente no encontrado' };
		}
		existingCustomerId = customer.id;
	} else if (data.newCustomer) {
		const normalizedIdNumber = normalizeIdNumber(data.newCustomer.idNumber);
		const existing = await findCustomerByIdNumber(normalizedIdNumber);
		if (existing) {
			return { error: 'Ya existe un cliente con ese documento' };
		}
	}

	return { customerId: existingCustomerId };
}

/** Create the inline customer inside the caller's transaction. */
export async function createInlineCustomer(
	input: InlineCustomerInput,
	executor: DbOrTx
): Promise<Customer> {
	return createCustomer(
		{
			firstName: input.firstName,
			lastName: input.lastName,
			idNumber: normalizeIdNumber(input.idNumber),
			primaryPhone: input.primaryPhone ?? '',
			email: input.email || null,
			address: input.address || null,
			notes: input.notes ?? null
		},
		executor
	);
}
