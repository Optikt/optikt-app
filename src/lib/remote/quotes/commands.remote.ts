/**
 * Quotes remote — create + update commands
 * Split from quotes.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { toSaleTotalsLine, buildQuoteItemValues } from './helpers';
import { command } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { CreateQuoteSchema, UpdateQuoteSchema } from '$lib/schemas/quotes';
import { findQuoteById, getNextQuoteNumber, deleteQuoteItems } from '$lib/server/db/queries/quotes';

import {
	findCustomerById,
	createCustomer,
	findCustomerByIdNumber
} from '$lib/server/db/queries/customers';

import { db } from '$lib/server/db';
import { quotes, quoteItems, quoteItemFreeDetails } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
import { normalizeIdNumber } from '$lib/utils';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

import { auditService, getAuditContext } from '$lib/server/audit';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';
import { eq } from 'drizzle-orm';

import { nowISO } from '$lib/dates';

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Create a new quote with items in a single transaction.
 * No stock changes - quotes are informational until converted.
 */
export const createNewQuote = command(CreateQuoteSchema, async (data) => {
	requireAuth();

	const context = getAuditContext();

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

	// Validate TREATMENT items
	const lensItemMap = new Map<string, string>();
	for (const item of data.items) {
		if (item.itemType === SaleItemType.LENS_PAIR && item.id && item.lensCatalogItemId) {
			lensItemMap.set(item.id, item.lensCatalogItemId);
		}
	}

	for (const item of data.items) {
		if (item.itemType !== SaleItemType.TREATMENT) continue;

		if (!item.parentQuoteItemId) {
			return { success: false as const, error: 'Tratamiento requiere un ítem de lente padre' };
		}
		const parentLensId = lensItemMap.get(item.parentQuoteItemId);
		if (!parentLensId) {
			return {
				success: false as const,
				error: 'Tratamiento referencia un ítem padre que no es tipo LENS_PAIR'
			};
		}

		if (!item.supplierTreatmentId) {
			return { success: false as const, error: 'Tratamiento requiere un supplierTreatmentId' };
		}

		const lens = await findLensCatalogItemById(parentLensId);
		if (!lens) {
			return { success: false as const, error: 'Lente padre no encontrado' };
		}
		if (lens.source !== 'LAB') {
			return {
				success: false as const,
				error: 'Los tratamientos solo aplican a cristales de tipo LAB'
			};
		}

		const treatment = await findSupplierTreatmentById(item.supplierTreatmentId);
		if (!treatment) {
			return { success: false as const, error: 'Tratamiento de proveedor no encontrado' };
		}
		if (treatment.supplierId !== lens.supplierId) {
			return {
				success: false as const,
				error: 'El tratamiento debe pertenecer al mismo proveedor del cristal'
			};
		}
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
				sellerId: context.userId!,
				quoteDate: data.quoteDate,
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
		for (const item of data.items) {
			const quoteItemId = item.id ?? crypto.randomUUID();
			await tx
				.insert(quoteItems)
				.values(buildQuoteItemValues({ ...item, id: quoteItemId }, newQuote.id, now));

			// For FREE_ITEM: insert the free details row
			if (item.itemType === SaleItemType.FREE_ITEM) {
				await tx.insert(quoteItemFreeDetails).values({
					id: crypto.randomUUID(),
					quoteItemId,
					category: item.freeItemCategory!,
					description: item.freeItemDescription!,
					enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
					unitCost: item.freeItemUnitCost ?? null,
					supplierId: item.freeItemSupplierId ?? null,
					opticalNotes: item.freeItemOpticalNotes ?? null,
					createdAt: now,
					updatedAt: now
				});
			}
		}

		return newQuote;
	});

	// Audit log (best-effort)
	await auditService.logCreate('quote', quote, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, quote };
});

/**
 * Update a quote (only DRAFT quotes can be edited).
 * Replaces all items.
 */
export const updateExistingQuote = command(UpdateQuoteSchema, async (data) => {
	requireAuth();

	const context = getAuditContext();

	const existing = await findQuoteById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (existing.status !== QuoteStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar presupuestos en borrador' };
	}

	// Calculate totals from new items
	const discount = data.discount ?? existing.discount;
	const discountType = data.discountType ?? existing.discountType;
	const totals = computeSaleTotals(
		data.items.map((item) =>
			toSaleTotalsLine(item, data.snapshotTaxRate ?? existing.snapshotTaxRate)
		),
		discount,
		discountType
	);
	const subtotal = totals.subtotal;
	const total = totals.total;

	const quote = await db.transaction(async (tx) => {
		const now = nowISO();

		// Update quote header
		const [updated] = await tx
			.update(quotes)
			.set({
				customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
				subtotal,
				discount,
				discountType,
				snapshotTaxRate: data.snapshotTaxRate ?? existing.snapshotTaxRate,
				total,
				validUntil:
					data.validUntil !== undefined
						? data.validUntil
							? data.validUntil
							: null
						: existing.validUntil,
				notes: data.notes !== undefined ? data.notes : existing.notes,
				updatedAt: now
			})
			.where(eq(quotes.id, data.id))
			.returning();

		// Delete existing items and recreate (cascade deletes quoteItemFreeDetails)
		await deleteQuoteItems(data.id, tx);
		for (const item of data.items) {
			const quoteItemId = item.id ?? crypto.randomUUID();
			await tx
				.insert(quoteItems)
				.values(buildQuoteItemValues({ ...item, id: quoteItemId }, data.id, now));

			// For FREE_ITEM: insert the free details row
			if (item.itemType === SaleItemType.FREE_ITEM) {
				await tx.insert(quoteItemFreeDetails).values({
					id: crypto.randomUUID(),
					quoteItemId,
					category: item.freeItemCategory!,
					description: item.freeItemDescription!,
					enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
					unitCost: item.freeItemUnitCost ?? null,
					supplierId: item.freeItemSupplierId ?? null,
					opticalNotes: item.freeItemOpticalNotes ?? null,
					createdAt: now,
					updatedAt: now
				});
			}
		}

		return updated;
	});

	// Audit log
	await auditService.logUpdate('quote', data.id, existing, quote, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, quote };
});
