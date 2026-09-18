import { toSaleTotalsLine, derivePrescriptionFromQuoteItems } from '$lib/remote/quotes/helpers';
import { findQuoteById, getQuoteItemsWithDetails } from '$lib/server/db/queries/quotes';
import {
	findCustomerById,
	createPrescription,
	unsetCurrentPrescriptions
} from '$lib/server/db/queries/customers';
import { getNextOrderNumber } from '$lib/server/db/queries/sales/reads';
import { db } from '$lib/server/db';
import { quotes, sales, type Prescription } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { SaleStatus } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import { auditService } from '$lib/server/audit';
import { eq } from 'drizzle-orm';
import { nowISO, toISODate, nowUTC } from '$lib/dates';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { toPrescriptionInsert } from '$lib/utils/prescription';
import { insertSaleItem } from '$lib/server/sales/saleItemInsert';
import type { ConvertQuoteInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Convert a DRAFT quote to a sale.
 * Creates a new sale with the same items as the quote.
 * Customer must be assigned to the quote before conversion.
 */
export async function convertQuoteToSaleCore(data: ConvertQuoteInput, ctx: ActionContext) {
	const quote = await findQuoteById(data.id);
	if (!quote) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (quote.status !== QuoteStatus.DRAFT) {
		return {
			success: false as const,
			error: 'Solo se pueden convertir presupuestos en borrador'
		};
	}
	if (!quote.customerId) {
		return {
			success: false as const,
			error: 'El presupuesto debe tener un cliente asignado para convertirlo a venta'
		};
	}

	const customer = await findCustomerById(quote.customerId);
	if (!customer) {
		return { success: false as const, error: 'Cliente del presupuesto no encontrado' };
	}

	// Get all quote items
	const items = await getQuoteItemsWithDetails(data.id);
	if (items.length === 0) {
		return { success: false as const, error: 'El presupuesto no tiene ítems' };
	}

	// Recomputed totals — never copy quote.subtotal/quote.total (pre-tax semantics)
	const totals = computeSaleTotals(
		items.map((item) => toSaleTotalsLine(item, quote.snapshotTaxRate)),
		quote.discount,
		quote.discountType
	);

	// Build a map of quote item IDs → new sale item IDs (for treatment parent references)
	const idMap = new Map<string, string>();
	for (const item of items) {
		idMap.set(item.id, crypto.randomUUID());
	}

	// Freeze the live USD BCV rate for future tickera reprints (null when API down)
	const liveBcvRate = await getExchangeRateValue('USD');
	const snapshotBcvRate = liveBcvRate !== null && liveBcvRate > 0 ? liveBcvRate : null;

	// All writes in a single transaction
	const { sale, prescription } = await db.transaction(async (tx) => {
		const now = nowISO();
		const orderNumber = await getNextOrderNumber(tx);
		const prescriptionPayload = derivePrescriptionFromQuoteItems(items, toISODate(nowUTC()));
		let createdPrescription: Prescription | null = null;

		if (prescriptionPayload) {
			await unsetCurrentPrescriptions(quote.customerId!, undefined, tx);
			createdPrescription = await createPrescription(
				toPrescriptionInsert(quote.customerId!, prescriptionPayload),
				tx
			);
		}

		// Create the sale
		const [newSale] = await tx
			.insert(sales)
			.values({
				id: crypto.randomUUID(),
				orderNumber,
				customerId: quote.customerId!,
				sellerId: ctx.userId!,
				/** createdAt is the single date truth: conversion day + time = now */
				createdAt: now,
				status: SaleStatus.PENDING,
				subtotal: totals.subtotal,
				discount: quote.discount,
				discountType: quote.discountType,
				snapshotTaxRate: quote.snapshotTaxRate,
				/** Frozen USD BCV rate for tickera reprints */
				snapshotBcvRate,
				total: totals.total,
				paidAmountBcvUsd: 0,
				notes: quote.notes ?? null,
				updatedAt: now
			})
			.returning();

		// Create sale items from quote items + handle stock via FIFO
		for (const item of items) {
			const newId = idMap.get(item.id)!;
			const parentSaleItemId = item.parentQuoteItemId
				? (idMap.get(item.parentQuoteItemId) ?? null)
				: null;

			await insertSaleItem(tx, {
				id: newId,
				saleId: newSale.id,
				item,
				parentSaleItemId,
				prescriptionId:
					item.itemType === SaleItemType.LENS_PAIR ? (createdPrescription?.id ?? null) : null,
				userId: ctx.userId!,
				now
			});
		}

		// Mark quote as converted
		await tx
			.update(quotes)
			.set({
				status: QuoteStatus.CONVERTED,
				conversionSaleId: newSale.id,
				updatedAt: now
			})
			.where(eq(quotes.id, data.id));

		return { sale: newSale, prescription: createdPrescription };
	});

	// Audit logs (best-effort)
	if (prescription) {
		await auditService.logCreate('prescription', prescription, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	await auditService.logCreate('sale', sale, ctx, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, sale };
}
