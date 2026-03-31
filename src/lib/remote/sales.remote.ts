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
	updateSale,
	getNextOrderNumber
} from '$lib/server/db/queries/sales';
import type { SaleWithRelations, SaleItemWithDetails } from '$lib/server/db/queries/sales';
import {
	findCustomerById,
	findCustomerByIdNumber,
	createCustomer
} from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import {
	sales,
	saleItems,
	products,
	lensCatalogItems,
	type SalePayment,
	type Customer
} from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { SaleStatus, isBsPaymentMethod, type PaymentMethod } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { normalizeIdNumber, computeDiscount } from '$lib/utils';
import { auditService, getAuditContext } from '$lib/server/audit';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';

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
 * Persists items with prescriptions and decrements product stock.
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

	// ── Validate TREATMENT items ─────────────────────────────────────────
	// Build a map of client-generated IDs → lens catalog item IDs for parent lookup
	const lensItemMap = new Map<string, string>(); // id → lensCatalogItemId
	for (const item of data.items) {
		if (item.itemType === SaleItemType.LENS_PAIR && item.id && item.lensCatalogItemId) {
			lensItemMap.set(item.id, item.lensCatalogItemId);
		}
	}

	for (const item of data.items) {
		if (item.itemType !== SaleItemType.TREATMENT) continue;

		// Require parentSaleItemId → must reference a LENS_PAIR item in this sale
		if (!item.parentSaleItemId) {
			return { success: false as const, error: 'Tratamiento requiere un ítem de lente padre' };
		}
		const parentLensId = lensItemMap.get(item.parentSaleItemId);
		if (!parentLensId) {
			return {
				success: false as const,
				error: 'Tratamiento referencia un ítem padre que no es tipo LENS_PAIR'
			};
		}

		// Require supplierTreatmentId
		if (!item.supplierTreatmentId) {
			return {
				success: false as const,
				error: 'Tratamiento requiere un supplierTreatmentId'
			};
		}

		// Validate: lens must be LAB source
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

		// Validate: treatment must belong to the same supplier as the lens
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
	const { sale, newCustomer } = await db.transaction(async (tx) => {
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
		const orderNumber = await getNextOrderNumber(tx);
		const [newSale] = await tx
			.insert(sales)
			.values({
				id: crypto.randomUUID(),
				orderNumber,
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

		// Create sale items + handle stock
		for (const item of data.items) {
			await tx.insert(saleItems).values({
				id: item.id ?? crypto.randomUUID(),
				saleId: newSale.id,
				itemType: item.itemType,
				parentSaleItemId: item.parentSaleItemId ?? null,
				productId: item.productId ?? null,
				lensCatalogItemId: item.lensCatalogItemId ?? null,
				supplierTreatmentId: item.supplierTreatmentId ?? null,
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
				snapshotName: item.snapshotName ?? null,
				snapshotSku: item.snapshotSku ?? null,
				snapshotBrand: item.snapshotBrand ?? null,
				snapshotBaseCost: item.snapshotBaseCost ?? null,
				snapshotMountingPrice: item.snapshotMountingPrice ?? null,
				snapshotShippingPrice: item.snapshotShippingPrice ?? null,
				snapshotSalePrice: item.snapshotSalePrice ?? null,
				snapshotPriceType: item.snapshotPriceType ?? null,
				snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? null,
				notes: item.notes ?? null,
				createdAt: now,
				updatedAt: now
			});

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

				if (!lens) {
					throw new Error(`Lente ${item.lensCatalogItemId} no encontrado`);
				}

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

		return { sale: newSale, newCustomer: createdCustomer };
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

	// Use the user-entered USD BCV amount directly (avoids floating-point drift from back-calculation)
	const method = data.paymentMethod as PaymentMethod;
	const amountBcvUsd = data.usdBcvAmount;
	const paymentDate = new Date(`${data.paymentDate}T12:00:00.000Z`);

	if (!isBsPaymentMethod(method) && !data.exchangeRate) {
		return { success: false as const, error: 'Tasa de cambio requerida para este método' };
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
				paymentDate,
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

	await db.transaction(async (tx) => {
		const now = new Date();

		// Get all items for this sale
		const items = await tx
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

		// Restore stock for product and lens items
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

			if (item.lensCatalogItemId) {
				const [lens] = await tx
					.select({
						id: lensCatalogItems.id,
						stock: lensCatalogItems.stock,
						inventoryMode: lensCatalogItems.inventoryMode
					})
					.from(lensCatalogItems)
					.where(eq(lensCatalogItems.id, item.lensCatalogItemId));

				if (lens && lens.inventoryMode === 'STOCK' && lens.stock !== null) {
					await tx
						.update(lensCatalogItems)
						.set({ stock: lens.stock + item.quantity, updatedAt: now })
						.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
				}
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

	return { success: true };
});
