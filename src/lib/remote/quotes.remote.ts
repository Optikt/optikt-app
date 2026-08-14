/**
 * Quotes (Presupuestos) Remote Functions
 * Server-side functions for quote management
 */
import { query, command } from '$app/server';
import { requireAuth, requireRole } from '$lib/server/guards';
import {
	ListQuotesSchema,
	CreateQuoteSchema,
	UpdateQuoteSchema,
	QuoteIdSchema,
	AssignQuoteCustomerSchema,
	CancelQuoteSchema,
	ConvertQuoteSchema
} from '$lib/schemas/quotes';
import {
	getAllQuotes,
	countQuotes,
	getQuoteStats as getQuoteStatsQuery,
	findQuoteById,
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails,
	getNextQuoteNumber,
	updateQuote,
	deleteQuoteItems
} from '$lib/server/db/queries/quotes';
import type {
	QuoteWithRelations,
	QuoteItemWithDetails,
	QuoteStats
} from '$lib/server/db/queries/quotes';
import {
	findCustomerById,
	resolveInlineCustomer,
	createCustomer,
	findCustomerByIdNumber,
	createPrescription,
	unsetCurrentPrescriptions
} from '$lib/server/db/queries/customers';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';
import { db } from '$lib/server/db';
import {
	quotes,
	quoteItems,
	quoteItemFreeDetails,
	saleItemFreeDetails,
	sales,
	saleItems,
	type Prescription
} from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import {
	ALL_LENS_TYPES,
	LensType,
	SaleItemType,
	FreeItemEnrichmentStatus
} from '$lib/shared/enums/lensTypes';
import { computeDiscount, normalizeIdNumber } from '$lib/utils';
import type { QuoteItemInput } from '$lib/schemas/quotes';
import type { PrescriptionFieldsInput } from '$lib/schemas/prescriptions';
import { auditService, getAuditContext } from '$lib/server/audit';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';
import { eq } from 'drizzle-orm';
import { consumeFifoForSaleItem } from '$lib/server/db/queries/fifoConsumption';
import { monthStart, nowISO, toUTCString } from '$lib/dates';
import { EmptySchema } from '$lib/schemas/common';
import { computeLensSnapshotCostTotal, computeSnapshotCostUnit } from '$lib/shared/saleItemCosts';
import { toPrescriptionInsert } from '$lib/utils/prescription';

// ============================================================================
// HELPERS
// ============================================================================

function buildQuoteItemValues(item: QuoteItemInput, quoteId: string, now: string) {
	return {
		id: item.id ?? crypto.randomUUID(),
		quoteId,
		itemType: item.itemType,
		parentQuoteItemId: item.parentQuoteItemId ?? null,
		productId: item.productId ?? null,
		lensCatalogItemId: item.lensCatalogItemId ?? null,
		supplierTreatmentId: item.supplierTreatmentId ?? null,
		odSphere: item.odSphere ?? null,
		odCylinder: item.odCylinder ?? null,
		odAxis: item.odAxis ?? null,
		odAddition: item.odAddition ?? null,
		osSphere: item.osSphere ?? null,
		osCylinder: item.osCylinder ?? null,
		osAxis: item.osAxis ?? null,
		osAddition: item.osAddition ?? null,
		quantity: item.quantity,
		unitPrice: item.unitPrice,
		discount: item.discount,
		discountType: item.discountType,
		snapshotName: item.snapshotName ?? null,
		snapshotSku: item.snapshotSku ?? null,
		snapshotBrand: item.snapshotBrand ?? null,
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
	};
}

function resolveLensSnapshotCosts(item: {
	itemType: string;
	quantity: number;
	snapshotBaseCost?: number | null;
	snapshotMountingPrice?: number | null;
	snapshotShippingPrice?: number | null;
}): { snapshotCostTotal: number | null; snapshotCostUnit: number | null } {
	if (item.itemType !== SaleItemType.LENS_PAIR) {
		return { snapshotCostTotal: null, snapshotCostUnit: null };
	}

	const snapshotCostTotal = computeLensSnapshotCostTotal({
		snapshotBaseCost: item.snapshotBaseCost,
		snapshotMountingPrice: item.snapshotMountingPrice,
		snapshotShippingPrice: item.snapshotShippingPrice,
		shippingCostPending: false
	});

	return {
		snapshotCostTotal,
		snapshotCostUnit: computeSnapshotCostUnit(snapshotCostTotal, item.quantity)
	};
}

function firstDefined<T>(values: Array<T | null | undefined>): T | undefined {
	return values.find((value): value is T => value != null);
}

function derivePrescriptionFromQuoteItems(
	items: QuoteItemWithDetails[],
	prescriptionDate: string
): PrescriptionFieldsInput | undefined {
	const lensItems = items.filter((item) => item.itemType === SaleItemType.LENS_PAIR);
	if (lensItems.length === 0) return undefined;

	const odSphere = firstDefined(lensItems.map((item) => item.odSphere));
	const odCylinder = firstDefined(lensItems.map((item) => item.odCylinder));
	const odAxis = firstDefined(lensItems.map((item) => item.odAxis));
	const odAddition = firstDefined(lensItems.map((item) => item.odAddition));
	const osSphere = firstDefined(lensItems.map((item) => item.osSphere));
	const osCylinder = firstDefined(lensItems.map((item) => item.osCylinder));
	const osAxis = firstDefined(lensItems.map((item) => item.osAxis));
	const osAddition = firstDefined(lensItems.map((item) => item.osAddition));

	if (
		[odSphere, odCylinder, odAxis, odAddition, osSphere, osCylinder, osAxis, osAddition].every(
			(value) => value == null
		)
	) {
		return undefined;
	}

	const recommendedLensTypeCandidate = firstDefined(
		lensItems.map((item) => item.lensCatalogItem?.type)
	);
	const recommendedLensType = ALL_LENS_TYPES.includes(recommendedLensTypeCandidate as LensType)
		? (recommendedLensTypeCandidate as LensType)
		: LensType.MONOFOCAL;

	return {
		prescriptionDate,
		odSphere,
		odCylinder,
		odAxis,
		odAddition,
		osSphere,
		osCylinder,
		osAxis,
		osAddition,
		dp: undefined,
		npRight: undefined,
		npLeft: undefined,
		odAltura: undefined,
		osAltura: undefined,
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: undefined,
		recommendedLensType,
		notes: undefined,
		doctorName: '',
		isCurrent: true
	};
}

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedQuotes {
	quotes: QuoteWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

export interface QuoteDetail {
	quote: QuoteWithRelations;
	items: QuoteItemWithDetails[];
}

export type { QuoteStats } from '$lib/server/db/queries/quotes';

// ============================================================================
// QUERIES
// ============================================================================

export const getQuoteStats = query(EmptySchema, async (): Promise<QuoteStats> => {
	requireAuth();

	return getQuoteStatsQuery(toUTCString(monthStart()));
});

/**
 * List quotes with pagination and filters
 */
export const listQuotes = query(ListQuotesSchema, async (data): Promise<PaginatedQuotes> => {
	requireAuth();

	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ?? undefined,
		dateTo: data.dateTo ?? undefined,
		search: data.search ?? undefined
	};

	const [quotesPage, total] = await Promise.all([
		getAllQuotes({
			...filterOptions,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		countQuotes(filterOptions)
	]);

	const totalPages = Math.ceil(total / perPage);

	return { quotes: quotesPage, total, page, perPage, totalPages };
});

/**
 * Get full quote detail (quote + items)
 */
export const getQuoteDetail = query(QuoteIdSchema, async (data): Promise<QuoteDetail | null> => {
	requireAuth();

	const quoteWithRelations = await findQuoteByIdWithRelations(data.id);
	if (!quoteWithRelations) return null;

	const items = await getQuoteItemsWithDetails(data.id);

	return { quote: quoteWithRelations, items };
});

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
	const itemsSubtotal = data.items.reduce((acc, item) => {
		const lineTotal = item.unitPrice * item.quantity;
		const itemDiscount = computeDiscount(item.discount, item.discountType, lineTotal);
		return acc + lineTotal - itemDiscount;
	}, 0);

	const subtotal = itemsSubtotal;
	const globalDiscount = computeDiscount(data.discount, data.discountType, subtotal);
	const total = Math.max(0, subtotal - globalDiscount);

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
	const itemsSubtotal = data.items.reduce((acc, item) => {
		const lineTotal = item.unitPrice * item.quantity;
		const itemDiscount = computeDiscount(item.discount, item.discountType, lineTotal);
		return acc + lineTotal - itemDiscount;
	}, 0);

	const discount = data.discount ?? existing.discount;
	const discountType = data.discountType ?? existing.discountType;
	const subtotal = itemsSubtotal;
	const globalDiscount = computeDiscount(discount, discountType, subtotal);
	const total = Math.max(0, subtotal - globalDiscount);

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

	// Build a map of quote item IDs → new sale item IDs (for treatment parent references)
	const idMap = new Map<string, string>();
	for (const item of items) {
		idMap.set(item.id, crypto.randomUUID());
	}

	// All writes in a single transaction
	const { sale, prescription } = await db.transaction(async (tx) => {
		const now = nowISO();
		const orderNumber = await getNextOrderNumber(tx);
		const prescriptionPayload = derivePrescriptionFromQuoteItems(items, now.slice(0, 10));
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
				saleDate: now,
				status: SaleStatus.PENDING,
				subtotal: quote.subtotal,
				discount: quote.discount,
				discountType: quote.discountType,
				snapshotTaxRate: quote.snapshotTaxRate,
				total: quote.total,
				paidAmountBcvUsd: 0,
				notes: quote.notes ?? null,
				createdAt: now,
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
				osSphere: item.osSphere ?? null,
				osCylinder: item.osCylinder ?? null,
				osAxis: item.osAxis ?? null,
				osAddition: item.osAddition ?? null,
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
