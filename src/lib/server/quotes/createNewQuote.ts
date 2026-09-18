import { getNextQuoteNumber } from '$lib/server/db/queries/quotes';
import { db } from '$lib/server/db';
import { quotes } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import { auditService } from '$lib/server/audit';
import { insertQuoteItems } from '$lib/server/quotes/quoteItemInsert';
import { computeDocumentTotals } from '$lib/server/documentTotals';
import { createInlineCustomer, resolveCustomerReference } from '$lib/server/customerReference';
import { validateTreatmentItems } from '$lib/server/treatmentValidation';
import { composeBusinessTimestamp, nowISO } from '$lib/dates';
import type { CreateQuoteInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Create a new quote with items in a single transaction.
 * No stock changes - quotes are informational until converted.
 */
export async function createNewQuoteCore(data: CreateQuoteInput, ctx: ActionContext) {
	// Validate customer if provided
	const customerResolution = await resolveCustomerReference(data);
	if ('error' in customerResolution) {
		return { success: false as const, error: customerResolution.error };
	}
	const existingCustomerId = customerResolution.customerId;

	const treatmentError = await validateTreatmentItems(data.items);
	if (treatmentError) {
		return { success: false as const, error: treatmentError.error };
	}

	// Calculate totals
	const totals = computeDocumentTotals(
		data.items,
		data.discount,
		data.discountType,
		data.snapshotTaxRate ?? DEFAULT_TAX_RATE
	);
	const subtotal = totals.subtotal;
	const total = totals.total;

	// All writes in a single transaction
	const quote = await db.transaction(async (tx) => {
		const now = nowISO();
		const quoteNumber = await getNextQuoteNumber(tx);

		// Create new customer inside transaction if needed
		let customerId: string | null = existingCustomerId;
		if (!customerId && data.newCustomer) {
			customerId = (await createInlineCustomer(data.newCustomer, tx)).id;
		}

		const [newQuote] = await tx
			.insert(quotes)
			.values({
				id: crypto.randomUUID(),
				quoteNumber,
				customerId: customerId,
				sellerId: ctx.userId!,
				quoteDate: composeBusinessTimestamp(data.quoteDate),
				status: QuoteStatus.DRAFT,
				subtotal,
				discount: data.discount,
				discountType: data.discountType,
				snapshotTaxRate: data.snapshotTaxRate,
				total,
				validUntil: data.validUntil ?? null,
				notes: data.notes ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Create quote items (no stock changes!)
		await insertQuoteItems(tx, newQuote.id, data.items, now);

		return newQuote;
	});

	// Audit log (best-effort)
	await auditService.logCreate('quote', quote, ctx, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, quote };
}
