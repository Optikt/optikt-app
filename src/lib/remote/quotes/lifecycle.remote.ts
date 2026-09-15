/**
 * Quotes remote — assign + cancel + convert lifecycle
 * Shell: auth + delegate. convertQuoteToSale logic lives in src/lib/server/quotes/.
 */
import { command } from '$app/server';
import { requireAuth, requireRole } from '$lib/server/guards';
import {
	AssignQuoteCustomerSchema,
	CancelQuoteSchema,
	ConvertQuoteSchema
} from '$lib/schemas/quotes';
import { findQuoteById, updateQuote } from '$lib/server/db/queries/quotes';
import { findCustomerById, resolveInlineCustomer } from '$lib/server/db/queries/customers';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { UserRole } from '$lib/shared/enums';
import { auditService, getAuditContext } from '$lib/server/audit';
import { getActionContext } from '$lib/server/actionContext';
import { convertQuoteToSaleCore } from '$lib/server/quotes/convertQuoteToSale';

/**
 * Assign a customer to a DRAFT quote (existing customer or create new inline).
 */
export const assignQuoteCustomer = command(AssignQuoteCustomerSchema, async (data) => {
	requireAuth();

	const context = getAuditContext();

	const quote = await findQuoteById(data.id);
	if (!quote) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (quote.status !== QuoteStatus.DRAFT) {
		return {
			success: false as const,
			error: 'Solo se puede asignar cliente a presupuestos en borrador'
		};
	}

	let customerId: string;

	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { success: false as const, error: 'Cliente no encontrado' };
		}
		customerId = customer.id;
	} else if (data.newCustomer) {
		const result = await resolveInlineCustomer(data.newCustomer);
		if ('error' in result) return { success: false as const, error: result.error };
		customerId = result.customer.id;
	} else {
		return { success: false as const, error: 'Debe indicar un cliente' };
	}

	const updated = await updateQuote(data.id, { customerId });

	await auditService.logUpdate('quote', data.id, quote, updated!, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const };
});

/**
 * Cancel a quote (DRAFT → CANCELLED)
 */
export const cancelQuote = command(CancelQuoteSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	const quote = await findQuoteById(data.id);
	if (!quote) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (quote.status !== QuoteStatus.DRAFT) {
		return {
			success: false as const,
			error: 'Solo se pueden cancelar presupuestos en borrador'
		};
	}

	const updated = await updateQuote(data.id, { status: QuoteStatus.CANCELLED });

	await auditService.logUpdate('quote', data.id, quote, updated!, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const };
});

/**
 * Convert a DRAFT quote to a sale.
 */
export const convertQuoteToSale = command(ConvertQuoteSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return convertQuoteToSaleCore(data, getActionContext(user));
});
