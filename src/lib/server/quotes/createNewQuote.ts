import { toSaleTotalsLine } from '$lib/remote/quotes/helpers';
import { getNextQuoteNumber } from '$lib/server/db/queries/quotes';
import {
	findCustomerById,
	createCustomer,
	findCustomerByIdNumber
} from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import { quotes } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { normalizeIdNumber } from '$lib/utils';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import { auditService } from '$lib/server/audit';
import { insertQuoteItems } from '$lib/server/quotes/quoteItemInsert';
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
	let existingCustomerId: string | null = null;

	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { success: false as const, error: 'Cliente no encontrado' };
		}
		existingCustomerId = customer.id;
	} else if (data.newCustomer) {
		const normalizedIdNumber = normalizeIdNumber(data.newCustomer.idNumber);
		const existing = await findCustomerByIdNumber(normalizedIdNumber);
		if (existing) {
			return { success: false as const, error: 'Ya existe un cliente con ese documento' };
		}
	}

	const treatmentError = await validateTreatmentItems(data.items);
	if (treatmentError) {
		return { success: false as const, error: treatmentError.error };
	}

	// Calculate totals
	const totals = computeSaleTotals(
		data.items.map((item) => toSaleTotalsLine(item, data.snapshotTaxRate ?? DEFAULT_TAX_RATE)),
		data.discount,
		data.discountType
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
			const normalizedIdNumber = normalizeIdNumber(data.newCustomer.idNumber);
			const customer = await createCustomer(
				{
					firstName: data.newCustomer.firstName,
					lastName: data.newCustomer.lastName,
					idNumber: normalizedIdNumber,
					primaryPhone: data.newCustomer.primaryPhone ?? '',
					email: data.newCustomer.email || null,
					address: data.newCustomer.address || null,
					notes: data.newCustomer.notes ?? null
				},
				tx
			);
			customerId = customer.id;
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
