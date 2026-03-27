/**
 * Sales Remote Functions
 * Server-side functions for sale management
 */
import { query, command } from '$app/server';
import {
	ListSalesSchema,
	CreateSaleSchema,
	SaleIdSchema,
	CancelSaleSchema,
	AddPaymentSchema,
	VoidPaymentSchema,
	CustomerLookupSchema
} from '$lib/schemas/sales';
import {
	getAllSales,
	countSales,
	findSaleById,
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments,
	findPaymentById,
	addSalePayment,
	voidSalePayment,
	recalcSalePaidAmount,
	updateSale
} from '$lib/server/db/queries/sales';
import type { SaleWithRelations, SaleItemWithDetails } from '$lib/server/db/queries/sales';
import {
	findCustomerById,
	findCustomerByIdNumber,
	createCustomer
} from '$lib/server/db/queries/customers';
import {
	reserveSurplusUnit,
	consumeSurplusUnit,
	createSurplusUnit,
	findSurplusByOriginSaleId,
	voidSurplusUnit,
	restoreSurplusUnit
} from '$lib/server/db/queries/surplusUnits';
import { db } from '$lib/server/db';
import {
	sales,
	saleItems,
	products,
	lensCatalogItems,
	surplusUnits,
	type SalePayment,
	type Customer
} from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
	SaleStatus,
	LensCatalogSource,
	LensFulfillmentMode,
	isBsPaymentMethod,
	type PaymentMethod
} from '$lib/shared/enums';
import { FulfillmentSource, SurplusOriginType } from '$lib/shared/contracts/fulfillment';
import { PhotochromicMode } from '$lib/shared/contracts/lenses';
import { normalizeIdNumber, computeDiscount } from '$lib/utils';
import { auditService, getAuditContext } from '$lib/server/audit';

/**
 * Check whether a lens catalog item's stock should be decremented/restored.
 * Only FINISHED source lenses in INVENTORY fulfillment mode use tracked stock.
 */
function shouldDecrementLensStock(
	lensSource: string,
	lensFulfillmentMode: string | null | undefined
): boolean {
	return (
		lensSource === LensCatalogSource.FINISHED &&
		(lensFulfillmentMode ?? LensFulfillmentMode.INVENTORY) === LensFulfillmentMode.INVENTORY
	);
}

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedSales {
	sales: SaleWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

export interface SaleDetail {
	sale: SaleWithRelations;
	items: SaleItemWithDetails[];
	payments: SalePayment[];
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List sales with pagination and filters
 */
export const listSales = query(ListSalesSchema, async (data): Promise<PaginatedSales> => {
	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ? new Date(data.dateFrom) : undefined,
		dateTo: data.dateTo ? new Date(data.dateTo) : undefined,
		search: data.search ?? undefined
	};

	const [salesPage, total] = await Promise.all([
		getAllSales({
			...filterOptions,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		countSales(filterOptions)
	]);

	const totalPages = Math.ceil(total / perPage);

	return { sales: salesPage, total, page, perPage, totalPages };
});

/**
 * Get full sale detail (sale + items + payments)
 */
export const getSaleDetail = query(SaleIdSchema, async (data): Promise<SaleDetail | null> => {
	const saleWithRelations = await findSaleByIdWithRelations(data.id);
	if (!saleWithRelations) return null;

	const [items, payments] = await Promise.all([
		getSaleItemsWithDetails(data.id),
		getSalePayments(data.id, { includeVoided: true })
	]);

	return { sale: saleWithRelations, items, payments };
});

/**
 * Look up a customer by document ID (cédula/RIF)
 */
export const lookupCustomer = query(CustomerLookupSchema, async (data) => {
	const normalized = normalizeIdNumber(data.idNumber);
	const customer = await findCustomerByIdNumber(normalized);
	return { customer: customer ?? null };
});

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Create a new sale with items in a single transaction.
 * Handles fulfillment plan execution: persists items with treatments/prescriptions,
 * consumes surplus from inventory, creates surplus from forced pair purchases,
 * and decrements product stock.
 */
export const createSale = command(CreateSaleSchema, async (data) => {
	const context = getAuditContext();

	// Validate customer reference (reads only — safe outside transaction)
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
	} else {
		return { success: false as const, error: 'Debe seleccionar o crear un cliente' };
	}

	// Calculate totals from items (pure computation — safe outside transaction)
	const itemsSubtotal = data.items.reduce((acc, item) => {
		const lineTotal = item.unitPrice * item.quantity;
		const itemDiscount = computeDiscount(item.discount, item.discountType, lineTotal);
		return acc + lineTotal - itemDiscount;
	}, 0);

	const subtotal = itemsSubtotal;
	const globalDiscount = computeDiscount(data.discount, data.discountType, subtotal);
	const total = Math.max(0, subtotal - globalDiscount);

	// All writes in a single transaction
	const { sale, newCustomer, createdSurplusUnits } = await db.transaction(async (tx) => {
		const now = new Date();
		let customerId: string;
		let createdCustomer: Customer | null = null;

		if (existingCustomerId) {
			customerId = existingCustomerId;
		} else {
			const normalizedIdNumber = normalizeIdNumber(data.newCustomer!.idNumber);
			const customer = await createCustomer(
				{
					firstName: data.newCustomer!.firstName,
					lastName: data.newCustomer!.lastName,
					idNumber: normalizedIdNumber,
					primaryPhone: data.newCustomer!.primaryPhone ?? '',
					email: data.newCustomer!.email || null,
					address: data.newCustomer!.address || null,
					notes: data.newCustomer!.notes ?? null
				},
				tx
			);
			customerId = customer.id;
			createdCustomer = customer;
		}

		// Create the sale header
		const [newSale] = await tx
			.insert(sales)
			.values({
				id: crypto.randomUUID(),
				customerId,
				sellerId: context.userId!,
				saleDate: new Date(data.saleDate),
				status: SaleStatus.PENDING,
				subtotal,
				discount: data.discount,
				discountType: data.discountType,
				total,
				paidAmountBcvUsd: 0,
				notes: data.notes ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Create sale items + handle stock/surplus
		for (const item of data.items) {
			await tx.insert(saleItems).values({
				id: crypto.randomUUID(),
				saleId: newSale.id,
				productId: item.productId ?? null,
				lensCatalogItemId: item.lensCatalogItemId ?? null,
				lensFulfillmentMode: item.lensFulfillmentMode ?? null,
				eye: item.eye ?? null,
				fulfillmentSource: item.fulfillmentSource ?? null,
				surplusUnitId: item.surplusUnitId ?? null,
				selectedTreatments: item.selectedTreatments ?? null,
				costBreakdown: item.costBreakdown ?? null,
				prescriptionId: item.prescriptionId ?? null,
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
				notes: item.notes ?? null,
				createdAt: now,
				updatedAt: now
			});

			// Consume surplus for items sourced from surplus stock
			if (
				item.fulfillmentSource === FulfillmentSource.SURPLUS_STOCK &&
				item.surplusUnitId
			) {
				const reserved = await reserveSurplusUnit(item.surplusUnitId, newSale.id, tx);
				if (!reserved) {
					throw new Error(
						`No se pudo reservar la unidad de excedente ${item.surplusUnitId} — puede que ya no esté disponible`
					);
				}
				const consumed = await consumeSurplusUnit(item.surplusUnitId, newSale.id, tx);
				if (!consumed) {
					throw new Error(
						`No se pudo consumir la unidad de excedente ${item.surplusUnitId}`
					);
				}
			}

			// Decrement stock for product items
			if (item.productId) {
				const [product] = await tx
					.select({ id: products.id, stock: products.stock })
					.from(products)
					.where(and(eq(products.id, item.productId), isNull(products.deletedAt)));

				if (!product) {
					throw new Error(`Producto ${item.productId} no encontrado`);
				}

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

			// Decrement stock only for lenses fulfilled from catalog stock.
			// SUPPLIER_ORDER, LAB_ORDER, PAIR_BUNDLED, and SURPLUS_STOCK don't touch inventory.
			if (item.lensCatalogItemId && item.fulfillmentSource === FulfillmentSource.CATALOG_STOCK) {
				const [lens] = await tx
					.select({
						id: lensCatalogItems.id,
						stock: lensCatalogItems.stock,
						source: lensCatalogItems.source
					})
					.from(lensCatalogItems)
					.where(
						and(eq(lensCatalogItems.id, item.lensCatalogItemId), isNull(lensCatalogItems.deletedAt))
					);

				if (!lens) {
					throw new Error(`Lente ${item.lensCatalogItemId} no encontrado`);
				}

				if (shouldDecrementLensStock(lens.source, item.lensFulfillmentMode) && lens.stock !== null) {
					const newStock = lens.stock - item.quantity;
					if (newStock < 0) {
						throw new Error(
							`Stock insuficiente para el lente. Disponible: ${lens.stock}, solicitado: ${item.quantity}`
						);
					}
					await tx
						.update(lensCatalogItems)
						.set({ stock: newStock, updatedAt: now })
						.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
				}
			}
		}

		// Create surplus units from forced pair purchases
		const surplusCreated = [];
		for (const surplusInput of data.surplusToCreate) {
			// Look up catalog item identity for the physical signature
			const [catalogLens] = await tx
				.select({
					type: lensCatalogItems.type,
					materialId: lensCatalogItems.materialId,
					photochromicMode: lensCatalogItems.photochromicMode
				})
				.from(lensCatalogItems)
				.where(eq(lensCatalogItems.id, surplusInput.catalogItemId));

			if (!catalogLens) {
				throw new Error(`Lente de catálogo ${surplusInput.catalogItemId} no encontrado`);
			}

			const unit = await createSurplusUnit(
				{
					originType: SurplusOriginType.SALE_PURCHASE_PAIR_EXCESS,
					originSaleId: newSale.id,
					catalogItemId: surplusInput.catalogItemId,
					supplierId: surplusInput.supplierId,
					physicalSignature: {
						lensType: catalogLens.type as never,
						materialId: catalogLens.materialId,
						photochromic: catalogLens.photochromicMode === PhotochromicMode.INHERENT,
						requiredTreatments: surplusInput.selectedTreatments ?? [],
						originCatalogItemId: surplusInput.catalogItemId,
						prescription: surplusInput.prescription ?? {
							sphere: null,
							cylinder: null,
							axis: null,
							addition: null
						}
					},
					costSnapshot: surplusInput.costSnapshot
				},
				tx
			);
			surplusCreated.push(unit);
		}

		return { sale: newSale, newCustomer: createdCustomer, createdSurplusUnits: surplusCreated };
	});

	// Audit logs (best-effort, after transaction succeeds)
	if (newCustomer) {
		await auditService.logCreate('customer', newCustomer, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	await auditService.logCreate('sale', sale, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	for (const surplusUnit of createdSurplusUnits) {
		await auditService.logCreate('surplus_unit', surplusUnit, context, {
			excludeFields: ['createdAt', 'updatedAt']
		});
	}

	return { success: true as const, sale };
});

/**
 * Add a payment to a sale.
 * Computes amountBcvUsd based on payment method and exchange rates.
 * Auto-completes sale if fully paid.
 */
export const addPayment = command(AddPaymentSchema, async (data) => {
	const context = getAuditContext();

	const sale = await findSaleById(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}
	if (sale.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se pueden agregar pagos a una venta cancelada' };
	}

	// Compute BCV USD equivalent (pure computation — safe outside transaction)
	const method = data.paymentMethod as PaymentMethod;
	let amountBcvUsd: number;

	if (isBsPaymentMethod(method)) {
		amountBcvUsd = data.amount / data.bcvRate;
	} else {
		if (!data.exchangeRate) {
			return { success: false as const, error: 'Tasa de cambio requerida para este método' };
		}
		amountBcvUsd = (data.amount * data.exchangeRate) / data.bcvRate;
	}

	// All writes in a single transaction: payment + recalc + auto-complete
	const { payment, paidAmount } = await db.transaction(async (tx) => {
		const newPayment = await addSalePayment(
			{
				saleId: data.saleId,
				paymentMethod: data.paymentMethod,
				amount: data.amount,
				exchangeRate: data.exchangeRate ?? null,
				bcvRate: data.bcvRate,
				amountBcvUsd,
				reference: data.reference ?? null,
				notes: data.notes ?? null
			},
			tx
		);

		const newPaidAmount = await recalcSalePaidAmount(data.saleId, tx);

		// Auto-complete if fully paid (small tolerance for floating point)
		if (newPaidAmount >= sale.total - 0.01 && sale.status === SaleStatus.PENDING) {
			await updateSale(data.saleId, { status: SaleStatus.COMPLETED }, tx);
		}

		return { payment: newPayment, paidAmount: newPaidAmount };
	});

	// Audit logs (best-effort, after transaction succeeds)
	if (paidAmount >= sale.total - 0.01 && sale.status === SaleStatus.PENDING) {
		const updated = await findSaleById(data.saleId);
		if (updated) {
			await auditService.logUpdate('sale', data.saleId, sale, updated, context, {
				excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
			});
		}
	}

	await auditService.logCreate('sale_payment', payment, context, {
		excludeFields: ['createdAt', 'updatedAt']
	});

	return { success: true as const, payment, paidAmount };
});

/**
 * Void a payment and recalculate paid amount.
 * Re-opens sale to PENDING if it was COMPLETED and is now underpaid.
 */
export const voidPayment = command(VoidPaymentSchema, async (data) => {
	const context = getAuditContext();

	const sale = await findSaleById(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}

	const payment = await findPaymentById(data.id);
	if (!payment || payment.saleId !== data.saleId) {
		return { success: false as const, error: 'Pago no encontrado' };
	}

	// All writes in a single transaction: void + recalc + status revert
	const paidAmount = await db.transaction(async (tx) => {
		const voided = await voidSalePayment(data.id, tx);
		if (!voided) {
			throw new Error('No se pudo anular el pago');
		}

		const newPaidAmount = await recalcSalePaidAmount(data.saleId, tx);

		// If sale was COMPLETED but now underpaid, revert to PENDING
		if (sale.status === SaleStatus.COMPLETED && newPaidAmount < sale.total - 0.01) {
			await updateSale(data.saleId, { status: SaleStatus.PENDING }, tx);
		}

		return newPaidAmount;
	});

	// Audit log (best-effort, after transaction succeeds)
	if (sale.status === SaleStatus.COMPLETED && paidAmount < sale.total - 0.01) {
		const updated = await findSaleById(data.saleId);
		if (updated) {
			await auditService.logUpdate('sale', data.saleId, sale, updated, context, {
				excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
			});
		}
	}

	return { success: true as const, paidAmount };
});

/**
 * Cancel a sale and restore stock for product/lens items.
 * Also voids any surplus units created by this sale (AVAILABLE/RESERVED → VOID).
 * Surplus units consumed by this sale are restored to AVAILABLE (unit was never physically used).
 */
export const cancelSale = command(CancelSaleSchema, async (data) => {
	const context = getAuditContext();

	const existing = await findSaleById(data.id);
	if (!existing) {
		return { success: false, error: 'Venta no encontrada' };
	}
	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false, error: 'La venta ya está cancelada' };
	}

	// Restore stock + void/restore surplus + update status in a transaction
	const voidedSurplus: Array<{ id: string }> = [];
	const restoredSurplus: Array<{ id: string }> = [];

	await db.transaction(async (tx) => {
		const now = new Date();

		// Get all items for this sale
		const items = await tx
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

		// Restore stock for product items
		for (const item of items) {
			if (item.productId) {
				const [product] = await tx
					.select({ id: products.id, stock: products.stock })
					.from(products)
					.where(eq(products.id, item.productId));

				if (product && product.stock !== null) {
					await tx
						.update(products)
						.set({ stock: product.stock + item.quantity, updatedAt: now })
						.where(eq(products.id, item.productId));
				}
			}

			// Restore stock for lens catalog items (only for items fulfilled from catalog stock)
			if (item.lensCatalogItemId && item.fulfillmentSource === FulfillmentSource.CATALOG_STOCK) {
				const [lens] = await tx
					.select({
						id: lensCatalogItems.id,
						stock: lensCatalogItems.stock,
						source: lensCatalogItems.source
					})
					.from(lensCatalogItems)
					.where(eq(lensCatalogItems.id, item.lensCatalogItemId));

				if (lens && shouldDecrementLensStock(lens.source, item.lensFulfillmentMode) && lens.stock !== null) {
					await tx
						.update(lensCatalogItems)
						.set({ stock: lens.stock + item.quantity, updatedAt: now })
						.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
				}
			}

			// Restore consumed surplus back to AVAILABLE (unit was never physically used)
			if (item.surplusUnitId && item.fulfillmentSource === FulfillmentSource.SURPLUS_STOCK) {
				const restored = await restoreSurplusUnit(item.surplusUnitId, tx);
				if (restored) {
					restoredSurplus.push({ id: restored.id });
				}
			}
		}

		// Void surplus units created by this sale (pair purchase excess)
		const createdSurplus = await findSurplusByOriginSaleId(data.id, tx);
		for (const unit of createdSurplus) {
			const voided = await voidSurplusUnit(
				unit.id,
				`Anulado por cancelación de venta`,
				tx
			);
			if (voided) {
				voidedSurplus.push({ id: voided.id });
			}
		}

		// Update sale status
		await updateSale(
			data.id,
			{
				status: SaleStatus.CANCELLED,
				notes: data.reason
					? `${existing.notes ?? ''}\n[Cancelada]: ${data.reason}`.trim()
					: existing.notes
			},
			tx
		);
	});

	// Audit logs (best-effort, after transaction succeeds)
	const updated = await findSaleById(data.id);
	if (updated) {
		await auditService.logUpdate('sale', data.id, existing, updated, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	for (const unit of voidedSurplus) {
		await auditService.logCustom(
			'surplus_unit',
			unit.id,
			'update',
			{
				status: { old: 'AVAILABLE', new: 'VOID' },
				reason: { old: null, new: 'sale_cancelled' }
			},
			context
		);
	}

	for (const unit of restoredSurplus) {
		await auditService.logCustom(
			'surplus_unit',
			unit.id,
			'update',
			{
				status: { old: 'CONSUMED', new: 'AVAILABLE' },
				reason: { old: null, new: 'sale_cancelled' }
			},
			context
		);
	}

	return { success: true };
});
