/**
 * Quotes remote — assign + cancel + convert lifecycle
 * Split from quotes.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import {
	toSaleTotalsLine,
	resolveLensSnapshotCosts,
	derivePrescriptionFromQuoteItems
} from './shared';
import { command } from '$app/server';
import { requireAuth, requireRole } from '$lib/server/guards';
import {
	AssignQuoteCustomerSchema,
	CancelQuoteSchema,
	ConvertQuoteSchema
} from '$lib/schemas/quotes';
import {
	findQuoteById,
	getQuoteItemsWithDetails,
	updateQuote
} from '$lib/server/db/queries/quotes';

import {
	findCustomerById,
	resolveInlineCustomer,
	createPrescription,
	unsetCurrentPrescriptions
} from '$lib/server/db/queries/customers';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';
import { db } from '$lib/server/db';
import {
	quotes,
	saleItemFreeDetails,
	sales,
	saleItems,
	type Prescription
} from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

import { computeSaleTotals } from '$lib/shared/saleTotals';

import { auditService, getAuditContext } from '$lib/server/audit';

import { eq } from 'drizzle-orm';
import { consumeFifoForSaleItem } from '$lib/server/db/queries/fifoConsumption';
import { nowISO, toISODate, nowUTC } from '$lib/dates';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';

import { toPrescriptionInsert } from '$lib/utils/prescription';

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
 * Creates a new sale with the same items as the quote.
 * Customer must be assigned to the quote before conversion.
 */
export const convertQuoteToSale = command(ConvertQuoteSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

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
				sellerId: context.userId!,
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

			let lotId: string | null = null;
			let snapshotCostTotal: number | null = null;
			let snapshotCostUnit: number | null = null;
			let snapshotLotsCount: number | null = null;

			// FREE_ITEM: no inventory impact — skip FIFO entirely
			if (item.itemType !== SaleItemType.FREE_ITEM) {
				// FIFO lot consumption + stock decrement (shared logic)
				({ lotId, snapshotCostTotal, snapshotCostUnit, snapshotLotsCount } =
					await consumeFifoForSaleItem(tx, newSale.id, item, context.userId!));
			}

			const lensSnapshotCosts = resolveLensSnapshotCosts(item);

			await tx.insert(saleItems).values({
				id: newId,
				saleId: newSale.id,
				itemType: item.itemType,
				parentSaleItemId,
				productId: item.productId ?? null,
				lensCatalogItemId: item.lensCatalogItemId ?? null,
				supplierTreatmentId: item.supplierTreatmentId ?? null,
				lotId,
				prescriptionId:
					item.itemType === SaleItemType.LENS_PAIR ? (createdPrescription?.id ?? null) : null,
				odSphere: item.odSphere ?? null,
				odCylinder: item.odCylinder ?? null,
				odAxis: item.odAxis ?? null,
				odAddition: item.odAddition ?? null,
				odAltura: item.odAltura ?? null,
				osSphere: item.osSphere ?? null,
				osCylinder: item.osCylinder ?? null,
				osAxis: item.osAxis ?? null,
				osAddition: item.osAddition ?? null,
				osAltura: item.osAltura ?? null,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				snapshotName: item.snapshotName ?? null,
				snapshotSku: item.snapshotSku ?? null,
				snapshotBrand: item.snapshotBrand ?? null,
				snapshotCostTotal: lensSnapshotCosts.snapshotCostTotal ?? snapshotCostTotal,
				snapshotCostUnit: lensSnapshotCosts.snapshotCostUnit ?? snapshotCostUnit,
				snapshotLotsCount,
				snapshotBaseCost: item.snapshotBaseCost ?? null,
				snapshotMountingPrice: item.snapshotMountingPrice ?? null,
				snapshotShippingPrice: item.snapshotShippingPrice ?? null,
				snapshotSalePrice: item.snapshotSalePrice ?? null,
				snapshotPriceType: item.snapshotPriceType ?? null,
				snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? null,
				snapshotIsTaxable: item.snapshotIsTaxable ?? null,
				notes: item.notes ?? null,
				createdAt: now,
				updatedAt: now
			});

			// FREE_ITEM: copy free details from quote to sale
			if (item.itemType === SaleItemType.FREE_ITEM && item.freeDetails) {
				await tx.insert(saleItemFreeDetails).values({
					id: crypto.randomUUID(),
					saleItemId: newId,
					category: item.freeDetails.category,
					description: item.freeDetails.description,
					enrichmentStatus: item.freeDetails.enrichmentStatus,
					unitCost: item.freeDetails.unitCost,
					supplierId: item.freeDetails.supplierId,
					opticalNotes: item.freeDetails.opticalNotes,
					// Preserve enrichment metadata if already enriched
					enrichedAt: item.freeDetails.enrichedAt,
					enrichedById: item.freeDetails.enrichedById,
					createdAt: now,
					updatedAt: now
				});
			}
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
		await auditService.logCreate('prescription', prescription, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	await auditService.logCreate('sale', sale, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, sale };
});
