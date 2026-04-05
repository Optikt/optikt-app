/**
 * Quotes (Presupuestos) Remote Functions
 * Server-side functions for quote management
 */
import { query, command } from '$app/server';
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
	findQuoteById,
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails,
	getNextQuoteNumber,
	updateQuote,
	deleteQuoteItems
} from '$lib/server/db/queries/quotes';
import type { QuoteWithRelations, QuoteItemWithDetails } from '$lib/server/db/queries/quotes';
import {
	findCustomerById,
	resolveInlineCustomer,
	createCustomer,
	findCustomerByIdNumber
} from '$lib/server/db/queries/customers';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';
import { db } from '$lib/server/db';
import { quotes, quoteItems, sales, saleItems } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { SaleStatus } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { computeDiscount, normalizeIdNumber } from '$lib/utils';
import type { QuoteItemInput } from '$lib/schemas/quotes';
import { auditService, getAuditContext } from '$lib/server/audit';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';
import { eq, and, isNull } from 'drizzle-orm';
import { products, lensCatalogItems } from '$lib/server/db/schema';
import { planFifoConsumption } from '$lib/utils/inventory';
import { getActiveLotsFifo, consumeFromLot } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums/inventoryTypes';

// ============================================================================
// HELPERS
// ============================================================================

function buildQuoteItemValues(item: QuoteItemInput, quoteId: string, now: Date) {
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
		snapshotTaxRate: item.snapshotTaxRate ?? null,
		notes: item.notes ?? null,
		createdAt: now,
		updatedAt: now
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

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List quotes with pagination and filters
 */
export const listQuotes = query(ListQuotesSchema, async (data): Promise<PaginatedQuotes> => {
	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ? new Date(data.dateFrom) : undefined,
		dateTo: data.dateTo ? new Date(data.dateTo) : undefined,
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
 * No stock changes — quotes are informational until converted.
 */
export const createNewQuote = command(CreateQuoteSchema, async (data) => {
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
		const now = new Date();
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
				quoteDate: new Date(data.quoteDate),
				status: QuoteStatus.DRAFT,
				subtotal,
				discount: data.discount,
				discountType: data.discountType,
				total,
				validUntil: data.validUntil ? new Date(data.validUntil) : null,
				notes: data.notes ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Create quote items (no stock changes!)
		for (const item of data.items) {
			await tx.insert(quoteItems).values(buildQuoteItemValues(item, newQuote.id, now));
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
		const now = new Date();

		// Update quote header
		const [updated] = await tx
			.update(quotes)
			.set({
				customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
				subtotal,
				discount,
				discountType,
				total,
				validUntil:
					data.validUntil !== undefined
						? data.validUntil
							? new Date(data.validUntil)
							: null
						: existing.validUntil,
				notes: data.notes !== undefined ? data.notes : existing.notes,
				updatedAt: now
			})
			.where(eq(quotes.id, data.id))
			.returning();

		// Delete existing items and recreate
		await deleteQuoteItems(data.id, tx);
		for (const item of data.items) {
			await tx.insert(quoteItems).values(buildQuoteItemValues(item, data.id, now));
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
	const sale = await db.transaction(async (tx) => {
		const now = new Date();
		const orderNumber = await getNextOrderNumber(tx);

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

			// FIFO lot consumption for PRODUCT items
			if (item.productId && item.itemType === SaleItemType.PRODUCT) {
				const [product] = await tx
					.select({ id: products.id, stock: products.stock, name: products.name })
					.from(products)
					.where(and(eq(products.id, item.productId), isNull(products.deletedAt)));

				if (!product) {
					throw new Error(`Producto ${item.productId} no encontrado`);
				}

				if (product.stock === null || product.stock < item.quantity) {
					throw new Error(
						`Stock insuficiente para ${product.name}. Disponible: ${product.stock ?? 0}, solicitado: ${item.quantity}`
					);
				}

				// Get FIFO lots and plan consumption (pure logic)
				const lots = await getActiveLotsFifo(item.productId, tx);
				const plan = planFifoConsumption(lots, item.quantity);

				// Execute the plan: consume lots + create movements
				for (const alloc of plan.allocations) {
					const updatedLot = await consumeFromLot(alloc.lotId, alloc.quantityToConsume, tx);

					await createInventoryMovement(
						{
							movementType: InventoryMovementType.SALE_OUT,
							lotId: alloc.lotId,
							itemType: 'PRODUCT',
							productId: item.productId,
							quantityDelta: -alloc.quantityToConsume,
							quantityBefore: alloc.quantityBeforeConsume,
							quantityAfter: updatedLot.quantityAvailable,
							referenceType: MovementReferenceType.SALE,
							referenceId: newSale.id,
							createdById: context.userId!
						},
						tx
					);
				}

				lotId = plan.primaryLotId;
				snapshotCostTotal = plan.costTotal;
				snapshotCostUnit = plan.costUnit;
				snapshotLotsCount = plan.lotsCount;

				// Update cached stock counter
				const newStock = product.stock - item.quantity;
				await tx
					.update(products)
					.set({ stock: newStock, updatedAt: now })
					.where(eq(products.id, item.productId));
			} else if (item.productId) {
				// Non-PRODUCT type but has productId (safe fallback)
				const [product] = await tx
					.select({ id: products.id, stock: products.stock })
					.from(products)
					.where(and(eq(products.id, item.productId), isNull(products.deletedAt)));

				if (!product) throw new Error(`Producto ${item.productId} no encontrado`);
				if (product.stock !== null) {
					const newStock = product.stock - item.quantity;
					if (newStock < 0) {
						throw new Error(
							`Stock insuficiente para el producto. Disponible: ${product.stock}, solicitado: ${item.quantity}`
						);
					}
					await tx
						.update(products)
						.set({ stock: newStock, updatedAt: now })
						.where(eq(products.id, item.productId));
				}
			}

			await tx.insert(saleItems).values({
				id: newId,
				saleId: newSale.id,
				itemType: item.itemType,
				parentSaleItemId,
				productId: item.productId ?? null,
				lensCatalogItemId: item.lensCatalogItemId ?? null,
				supplierTreatmentId: item.supplierTreatmentId ?? null,
				lotId,
				prescriptionId: null,
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
				snapshotCostTotal,
				snapshotCostUnit,
				snapshotLotsCount,
				snapshotBaseCost: item.snapshotBaseCost ?? null,
				snapshotMountingPrice: item.snapshotMountingPrice ?? null,
				snapshotShippingPrice: item.snapshotShippingPrice ?? null,
				snapshotSalePrice: item.snapshotSalePrice ?? null,
				snapshotPriceType: item.snapshotPriceType ?? null,
				snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? null,
				snapshotIsTaxable: item.snapshotIsTaxable ?? null,
				snapshotTaxRate: item.snapshotTaxRate ?? null,
				notes: item.notes ?? null,
				createdAt: now,
				updatedAt: now
			});

			// Decrement stock for lens catalog items with STOCK inventory mode
			if (item.lensCatalogItemId) {
				const [lens] = await tx
					.select({
						id: lensCatalogItems.id,
						stock: lensCatalogItems.stock,
						inventoryMode: lensCatalogItems.inventoryMode
					})
					.from(lensCatalogItems)
					.where(
						and(eq(lensCatalogItems.id, item.lensCatalogItemId), isNull(lensCatalogItems.deletedAt))
					);

				if (!lens) throw new Error(`Lente ${item.lensCatalogItemId} no encontrado`);
				if (lens.inventoryMode === 'STOCK') {
					const currentStock = lens.stock ?? 0;
					const newStock = currentStock - item.quantity;
					if (newStock < 0) {
						throw new Error(
							`Stock insuficiente para el lente. Disponible: ${currentStock}, solicitado: ${item.quantity}`
						);
					}
					await tx
						.update(lensCatalogItems)
						.set({ stock: newStock, updatedAt: now })
						.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
				}
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

		return newSale;
	});

	// Audit logs (best-effort)
	await auditService.logCreate('sale', sale, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, sale };
});
