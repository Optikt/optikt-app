/**
 * Quotes remote — cancel + convert lifecycle
 * Shell: auth + delegate. convertQuoteToSale logic lives in src/lib/server/quotes/.
 */
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { CancelQuoteSchema, ConvertQuoteSchema } from '$lib/schemas/quotes';
import { findQuoteById, updateQuote } from '$lib/server/db/queries/quotes';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { UserRole } from '$lib/shared/enums';
import { auditService, getAuditContext } from '$lib/server/audit';
import { getActionContext } from '$lib/server/actionContext';
import { convertQuoteToSaleCore } from '$lib/server/quotes/convertQuoteToSale';

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
 * Convert a DRAFT quote to a sale (D5: cliente existente, inline nuevo o el
 * heredado del presupuesto — todo dentro de la tx de conversión).
 */
export const convertQuoteToSale = command(ConvertQuoteSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	return convertQuoteToSaleCore(data, getActionContext(user));
});
