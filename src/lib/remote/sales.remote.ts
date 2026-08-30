/**
 * Sales Remote Functions
 * Server-side functions for sale management
 */
import { query, command } from '$app/server';
import { requireAuth, requireRole, requireAdmin } from '$lib/server/guards';
import {
	ListSalesSchema,
	CreateSaleSchema,
	SaleIdSchema,
	CancelSaleSchema,
	AddPaymentSchema,
	VoidPaymentSchema,
	CustomerLookupSchema,
	UpdateSaleItemCostsSchema,
	EnrichFreeItemSchema,
	UpdateSaleSchema,
	SetSaleStatusSchema
} from '$lib/schemas/sales';
import {
	getAllSales,
	countSales,
	getSalesStats as getSalesStatsQuery,
	findSaleById,
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments,
	findPaymentById,
	addSalePayment,
	voidSalePayment,
	recalcSalePaidAmount,
	updateSale as updateSaleQuery,
	getNextOrderNumber,
	updateSaleItemCosts
} from '$lib/server/db/queries/sales';
import type {
	SaleWithRelations,
	SaleItemWithDetails,
	SalesStats
} from '$lib/server/db/queries/sales';
import {
	findCustomerById,
	findCustomerByIdNumber,
	createCustomer,
	createPrescription,
	unsetCurrentPrescriptions
} from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import {
	sales,
	saleItems,
	saleItemFreeDetails,
	products,
	lensCatalogItems,
	type SalePayment,
	type Customer,
	type Prescription
} from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
	SaleStatus,
	RefundStatus,
	isBsPaymentMethod,
	type PaymentMethod,
	UserRole,
	canManageSaleByOwner
} from '$lib/shared/enums';
import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import { normalizeIdNumber, computeDiscount } from '$lib/utils';
import { auditService, getAuditContext } from '$lib/server/audit';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';
import { findSupplierById } from '$lib/server/db/queries/suppliers';
import { returnToLot } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import { consumeFifoForSaleItem } from '$lib/server/db/queries/fifoConsumption';
import { createExpense } from '$lib/server/db/queries/cash';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { inventoryMovements } from '$lib/server/db/schema';
import { monthStart, nowISO, toISODate, nowUTC, toUTCString } from '$lib/dates';
import { EmptySchema } from '$lib/schemas/common';
import { toPrescriptionInsert } from '$lib/utils/prescription';
import { computeLensSnapshotCostTotal, computeSnapshotCostUnit } from '$lib/shared/saleItemCosts';
import { computeSaleTotals, type SaleTotalsLine } from '$lib/shared/saleTotals';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

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

export type { SalesStats } from '$lib/server/db/queries/sales';

export interface SaleDetail {
	sale: SaleWithRelations;
	items: SaleItemWithDetails[];
	payments: SalePayment[];
}

function resolveLensSnapshotCosts(item: {
	itemType: string;
	quantity: number;
	snapshotBaseCost?: number | null;
	snapshotMountingPrice?: number | null;
	snapshotShippingPrice?: number | null;
	shippingCostPending?: boolean | null;
}): { snapshotCostTotal: number | null; snapshotCostUnit: number | null } {
	if (item.itemType !== SaleItemType.LENS_PAIR) {
		return { snapshotCostTotal: null, snapshotCostUnit: null };
	}

	const snapshotCostTotal = computeLensSnapshotCostTotal({
		snapshotBaseCost: item.snapshotBaseCost,
		snapshotMountingPrice: item.snapshotMountingPrice,
		snapshotShippingPrice: item.snapshotShippingPrice,
		shippingCostPending: item.shippingCostPending
	});

	return {
		snapshotCostTotal,
		snapshotCostUnit: computeSnapshotCostUnit(snapshotCostTotal, item.quantity)
	};
}

function toSaleTotalsLine(
	item: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable?: boolean | null;
		itemType: string;
	},
	taxRate: number
): SaleTotalsLine {
	return {
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		discount: item.discount,
		discountType: item.discountType,
		isTaxable: item.snapshotIsTaxable ?? (item.itemType === SaleItemType.PRODUCT ? true : false),
		taxRate
	};
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get aggregated sales stats (monthly, pending, completed, cancelled counts)
 */
export const getSalesStats = query(EmptySchema, async (): Promise<SalesStats> => {
	requireAuth();

	return getSalesStatsQuery(toUTCString(monthStart()));
});

/**
 * List sales with pagination and filters
 */
export const listSales = query(ListSalesSchema, async (data): Promise<PaginatedSales> => {
	requireAuth();

	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ?? undefined,
		dateTo: data.dateTo ?? undefined,
		search: data.search ?? undefined,
		shippingCostPending: data.shippingCostPending ?? undefined,
		hasFreeItem: data.hasFreeItem ?? undefined
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
	requireAuth();

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
	requireAuth();

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
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	// Only ADMIN can assign a custom order number (backfill historical sales).
	if (data.orderNumber && user.role !== UserRole.ADMIN) {
		return {
			success: false as const,
			error: 'Solo administradores pueden asignar un número de orden'
		};
	}

	// Validate customer reference (reads only - safe outside transaction)
	let existingCustomerId: string | null = null;

	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { success: false as const, error: 'Cliente no encontrado' };
		}
		existingCustomerId = customer.id;
	} else if (!data.newCustomer) {
		return { success: false as const, error: 'Debe seleccionar o crear un cliente' };
	} else {
		const normalizedIdNumber = normalizeIdNumber(data.newCustomer.idNumber);
		const existing = await findCustomerByIdNumber(normalizedIdNumber);
		if (existing) {
			return { success: false as const, error: 'Ya existe un cliente con ese documento' };
		}
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

	// Calculate totals from items (pure computation - safe outside transaction)
	const totals = computeSaleTotals(
		data.items.map((item) => toSaleTotalsLine(item, data.snapshotTaxRate ?? DEFAULT_TAX_RATE)),
		data.discount,
		data.discountType
	);
	const subtotal = totals.subtotal;
	const total = totals.total;
	const hasLensItems = data.items.some((item) => item.itemType === SaleItemType.LENS_PAIR);

	// All writes in a single transaction
	const { sale, newCustomer, prescription } = await db.transaction(async (tx) => {
		const now = nowISO();
		let customerId: string;
		let createdCustomer: Customer | null = null;
		let createdPrescription: Prescription | null = null;

		if (existingCustomerId) {
			customerId = existingCustomerId;
		} else {
			const customer = await createCustomer(
				{
					firstName: data.newCustomer!.firstName,
					lastName: data.newCustomer!.lastName,
					idNumber: normalizeIdNumber(data.newCustomer!.idNumber),
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

		if (data.prescription && hasLensItems) {
			await unsetCurrentPrescriptions(customerId, undefined, tx);
			createdPrescription = await createPrescription(
				toPrescriptionInsert(customerId, {
					...data.prescription,
					isCurrent: true
				}),
				tx
			);
		}

		// Create the sale header
		// Custom order number (admin backfill) or next sequential (MAX + 1),
		// so a backfilled #215 makes the default continue from #216.
		const orderNumber = data.orderNumber ?? (await getNextOrderNumber(tx));
		if (data.orderNumber) {
			const [existing] = await tx
				.select({ id: sales.id })
				.from(sales)
				.where(eq(sales.orderNumber, orderNumber));
			if (existing) {
				throw new Error(`El número de orden #${orderNumber} ya existe`);
			}
		}

		const [newSale] = await tx
			.insert(sales)
			.values({
				id: crypto.randomUUID(),
				orderNumber,
				customerId,
				sellerId: context.userId!,
				saleDate: data.saleDate,
				status: SaleStatus.PENDING,
				subtotal,
				discount: data.discount,
				discountType: data.discountType,
				snapshotTaxRate: data.snapshotTaxRate,
				total,
				paidAmountBcvUsd: 0,
				isCashea: data.isCashea ?? false,
				notes: data.notes ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		// Create sale items + handle stock via FIFO lot consumption
		for (const item of data.items) {
			const saleItemId = item.id ?? crypto.randomUUID();

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
				id: saleItemId,
				saleId: newSale.id,
				itemType: item.itemType,
				parentSaleItemId: item.parentSaleItemId ?? null,
				productId: item.productId ?? null,
				lensCatalogItemId: item.lensCatalogItemId ?? null,
				supplierTreatmentId: item.supplierTreatmentId ?? null,
				prescriptionId:
					item.itemType === SaleItemType.LENS_PAIR
						? (createdPrescription?.id ?? item.prescriptionId ?? null)
						: null,
				lotId,
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
				shippingCostPending: item.shippingCostPending ?? false,
				notes: item.notes ?? null,
				createdAt: now,
				updatedAt: now
			});

			// For FREE_ITEM: insert the free details row
			if (item.itemType === SaleItemType.FREE_ITEM) {
				await tx.insert(saleItemFreeDetails).values({
					id: crypto.randomUUID(),
					saleItemId,
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

		return { sale: newSale, newCustomer: createdCustomer, prescription: createdPrescription };
	});

	// Audit logs (best-effort, after transaction succeeds)
	if (newCustomer) {
		await auditService.logCreate('customer', newCustomer, context, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

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

/**
 * Add a payment to a sale.
 * Computes amountBcvUsd based on payment method and exchange rates.
 * Does NOT auto-complete the sale — status transitions are manual
 * (the UI offers to set READY/COMPLETED once the sale is fully paid).
 */
export const addPayment = command(AddPaymentSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

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
				rateType: data.rateType ?? null,
				isCasheaPayment: data.isCasheaPayment ?? false,
				bcvRate: data.bcvRate,
				paymentDate: data.paymentDate,
				amountBcvUsd,
				reference: data.reference ?? null,
				notes: data.notes ?? null
			},
			tx
		);

		const newPaidAmount = await recalcSalePaidAmount(data.saleId, tx);

		return { payment: newPayment, paidAmount: newPaidAmount };
	});

	// Audit logs (best-effort, after transaction succeeds)
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
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	const sale = await findSaleById(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}

	if (!canManageSaleByOwner(user.role, user.id, sale.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para anular pagos de esta venta' };
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

		// If sale was COMPLETED but now underpaid, revert to PENDING and clear completedAt.
		if (sale.status === SaleStatus.COMPLETED && newPaidAmount < sale.total - 0.01) {
			await updateSaleQuery(data.saleId, { status: SaleStatus.PENDING, completedAt: null }, tx);
		}
		// If sale was READY (fully paid) but now underpaid, reopen to IN_PROGRESS.
		else if (sale.status === SaleStatus.READY && newPaidAmount < sale.total - 0.01) {
			await updateSaleQuery(data.saleId, { status: SaleStatus.IN_PROGRESS }, tx);
		}

		return newPaidAmount;
	});

	// Audit log (best-effort, after transaction succeeds)
	const statusChangedByVoid =
		(sale.status === SaleStatus.COMPLETED || sale.status === SaleStatus.READY) &&
		paidAmount < sale.total - 0.01;
	if (statusChangedByVoid) {
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
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	const existing = await findSaleById(data.id);
	if (!existing) {
		return { success: false, error: 'Venta no encontrada' };
	}

	if (!canManageSaleByOwner(user.role, user.id, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para cancelar esta venta' };
	}

	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false, error: 'La venta ya está cancelada' };
	}

	const refundBcvRate =
		existing.paidAmountBcvUsd > 0 && data.refundStatus === RefundStatus.REFUNDED
			? await getExchangeRateValue('USD')
			: null;

	await db.transaction(async (tx) => {
		const now = nowISO();

		// Get all items for this sale
		const items = await tx
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

		// Find all SALE_OUT movements for this sale to revert lots
		const saleOutMovements = await tx
			.select()
			.from(inventoryMovements)
			.where(
				and(
					eq(inventoryMovements.referenceType, MovementReferenceType.SALE),
					eq(inventoryMovements.referenceId, data.id),
					eq(inventoryMovements.movementType, InventoryMovementType.SALE_OUT)
				)
			);

		// Revert lot consumption for each SALE_OUT movement
		for (const movement of saleOutMovements) {
			const quantityToReturn = Math.abs(movement.quantityDelta);
			const updatedLot = await returnToLot(movement.lotId, quantityToReturn, tx);

			// Create CANCEL_REVERT movement
			await createInventoryMovement(
				{
					movementType: InventoryMovementType.CANCEL_REVERT,
					lotId: movement.lotId,
					itemType: 'PRODUCT',
					productId: movement.productId!,
					quantityDelta: quantityToReturn,
					quantityBefore: updatedLot.quantityAvailable - quantityToReturn,
					quantityAfter: updatedLot.quantityAvailable,
					referenceType: MovementReferenceType.SALE,
					referenceId: data.id,
					createdById: context.userId!
				},
				tx
			);
		}

		// Restore cached stock for product and lens items
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

		// Update sale status, cancellation info, and refund disposition
		const hasPriorPayments = existing.paidAmountBcvUsd > 0;
		const refundStatus = hasPriorPayments ? data.refundStatus : RefundStatus.NO_PAYMENT;

		await updateSaleQuery(
			data.id,
			{
				status: SaleStatus.CANCELLED,
				cancellationReason: data.reason,
				cancelledAt: now,
				cancelledById: context.userId!,
				refundStatus,
				refundAmount: hasPriorPayments ? existing.paidAmountBcvUsd : null,
				refundNotes: hasPriorPayments ? (data.refundNotes ?? null) : null,
				refundedAt: now,
				refundedById: context.userId!
			},
			tx
		);

		// If the customer was actually reimbursed, log the refund as a USD
		// cash expense so the P&L reflects the cash leaving the box. The
		// payments themselves remain active (cash physically arrived) and the
		// refund offsets them on the egress side, preserving the trail.
		if (
			hasPriorPayments &&
			refundStatus === RefundStatus.REFUNDED &&
			existing.paidAmountBcvUsd > 0
		) {
			await createExpense(
				{
					category: 'REFUND',
					description: `Reembolso venta #${existing.orderNumber}: ${data.reason}`,
					currency: 'USD',
					amount: existing.paidAmountBcvUsd,
					amountUsd: existing.paidAmountBcvUsd,
					exchangeRate: null,
					bcvRate: refundBcvRate,
					rateType: null,
					expenseDate: toISODate(nowUTC()),
					registeredById: context.userId!,
					reference: `SALE:${existing.id}`,
					notes: data.refundNotes ?? null
				},
				tx
			);
		}
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

/**
 * Update the internal cost fields of a sale item.
 * Allows editing snapshotBaseCost, snapshotMountingPrice, snapshotShippingPrice,
 * and shippingCostPending after a sale has been created.
 */
export const updateItemCosts = command(UpdateSaleItemCostsSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	// Fetch the existing item for audit comparison
	const [existing] = await db
		.select()
		.from(saleItems)
		.where(and(eq(saleItems.id, data.saleItemId), isNull(saleItems.deletedAt)));

	if (!existing) {
		return { success: false as const, error: 'Artículo de venta no encontrado' };
	}

	const lensSnapshotCosts = resolveLensSnapshotCosts({
		itemType: existing.itemType,
		quantity: existing.quantity,
		snapshotBaseCost: data.snapshotBaseCost,
		snapshotMountingPrice: data.snapshotMountingPrice,
		snapshotShippingPrice: data.snapshotShippingPrice,
		shippingCostPending: data.shippingCostPending
	});

	const item = await updateSaleItemCosts(data.saleItemId, {
		snapshotBaseCost: data.snapshotBaseCost,
		snapshotMountingPrice: data.snapshotMountingPrice,
		snapshotShippingPrice: data.shippingCostPending ? null : data.snapshotShippingPrice,
		snapshotCostTotal: lensSnapshotCosts.snapshotCostTotal ?? existing.snapshotCostTotal,
		snapshotCostUnit: lensSnapshotCosts.snapshotCostUnit ?? existing.snapshotCostUnit,
		shippingCostPending: data.shippingCostPending
	});

	if (!item) {
		return { success: false as const, error: 'Error al actualizar costos' };
	}

	await auditService.logUpdate('sale_item', data.saleItemId, existing, item, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const };
});

/**
 * Enrich or re-enrich a FREE_ITEM sale item with confirmed cost, supplier, and optical notes.
 * ADMIN and MANAGER can enrich (cost data is financial information).
 * Moves enrichment_status from PENDING → ENRICHED, or overwrites an already-ENRICHED item.
 */
export const enrichFreeItem = command(EnrichFreeItemSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	// Find the sale item (validates it exists and is FREE_ITEM)
	const [saleItemRow] = await db
		.select()
		.from(saleItems)
		.where(and(eq(saleItems.id, data.saleItemId), isNull(saleItems.deletedAt)));

	if (!saleItemRow) {
		return { success: false as const, error: 'Artículo de venta no encontrado' };
	}

	if (saleItemRow.itemType !== SaleItemType.FREE_ITEM) {
		return { success: false as const, error: 'El artículo no es de tipo ítem libre' };
	}

	// Find the free details row
	const [freeDetailsRow] = await db
		.select()
		.from(saleItemFreeDetails)
		.where(eq(saleItemFreeDetails.saleItemId, data.saleItemId));

	if (!freeDetailsRow) {
		return { success: false as const, error: 'Detalles del ítem libre no encontrados' };
	}

	// Validate supplier if provided
	if (data.supplierId) {
		const supplier = await findSupplierById(data.supplierId);
		if (!supplier) {
			return { success: false as const, error: 'Proveedor no encontrado' };
		}
	}

	const now = nowISO();

	const [updated] = await db
		.update(saleItemFreeDetails)
		.set({
			unitCost: data.unitCost,
			supplierId: data.supplierId ?? null,
			opticalNotes: data.opticalNotes ?? null,
			enrichmentStatus: FreeItemEnrichmentStatus.ENRICHED,
			enrichedAt: now,
			enrichedById: context.userId!,
			updatedAt: now
		})
		.where(eq(saleItemFreeDetails.saleItemId, data.saleItemId))
		.returning();

	await auditService.logUpdate(
		'sale_item_free_details',
		freeDetailsRow.id,
		freeDetailsRow,
		updated,
		context,
		{
			excludeFields: ['createdAt', 'updatedAt']
		}
	);

	return { success: true as const, freeDetails: updated };
});

// ============================================================================
// UPDATE SALE
// ============================================================================

/**
 * Edit an existing sale: update header fields and/or replace items.
 *
 * Strict state/role enforcement:
 * - COMPLETED: blocked entirely.
 * - IN_PROGRESS / READY: only ADMIN/MANAGER may edit.
 * - PENDING: allowed for authorized users.
 *
 * When items change the full inventory is reset (CANCEL_REVERT) and
 * re-consumed (SALE_OUT) inside the same transaction.
 */
export const updateSale = command(UpdateSaleSchema, async (data) => {
	const user = requireAuth();
	const context = getAuditContext();

	// Read validation (outside transaction)
	const existing = await findSaleById(data.id);
	if (!existing) return { success: false as const, error: 'Venta no encontrada' };
	if (existing.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se puede modificar una venta cancelada' };
	}

	if (!canManageSaleByOwner(user.role, user.id, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	if (existing.status === SaleStatus.COMPLETED) {
		return { success: false as const, error: 'No se puede modificar una venta completada' };
	}

	const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;
	if (
		(existing.status === SaleStatus.IN_PROGRESS || existing.status === SaleStatus.READY) &&
		!isAdmin
	) {
		return {
			success: false as const,
			error: 'Solo administradores pueden modificar ventas en progreso o listas para retirar'
		};
	}

	// Order number reassignment: admin only (code-only for now, no UI field yet).
	if (data.orderNumber && !isAdmin) {
		return {
			success: false as const,
			error: 'Solo administradores pueden cambiar el número de orden'
		};
	}

	if (data.orderNumber) {
		const [existingOrder] = await db
			.select({ id: sales.id })
			.from(sales)
			.where(eq(sales.orderNumber, data.orderNumber));
		if (existingOrder) {
			return {
				success: false as const,
				error: `El número de orden #${data.orderNumber} ya existe`
			};
		}
	}

	// Payment protection
	const paidAmount = existing.paidAmountBcvUsd;

	// Validate customer reference if changed
	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) return { success: false as const, error: 'Cliente no encontrado' };
	}

	// Calculate new totals
	const hasItemChanges = !!data.items && data.items.length > 0;
	if (data.items && data.items.length === 0) {
		return { success: false as const, error: 'La venta debe tener al menos un artículo' };
	}

	let newSubtotal = existing.subtotal;

	const newDiscount = data.discount ?? existing.discount;
	const newDiscountType = data.discountType ?? existing.discountType;

	let newTotal = Math.max(
		0,
		newSubtotal - computeDiscount(newDiscount, newDiscountType, newSubtotal)
	);

	if (hasItemChanges) {
		const totals = computeSaleTotals(
			data.items!.map((item) =>
				toSaleTotalsLine(item, data.snapshotTaxRate ?? existing.snapshotTaxRate)
			),
			newDiscount,
			newDiscountType
		);
		newSubtotal = totals.subtotal;
		newTotal = totals.total;
	}

	if (newTotal < paidAmount - 0.01) {
		return {
			success: false as const,
			error:
				'La modificación reduce el total por debajo de lo ya cobrado. Por favor cancele esta venta y cree una nueva.'
		};
	}

	// All writes in a single transaction
	const updatedSale = await db.transaction(async (tx) => {
		if (hasItemChanges) {
			// ── 1. Revert all existing SALE_OUT inventory movements ──────────
			const saleOutMovements = await tx
				.select()
				.from(inventoryMovements)
				.where(
					and(
						eq(inventoryMovements.referenceType, MovementReferenceType.SALE),
						eq(inventoryMovements.referenceId, data.id),
						eq(inventoryMovements.movementType, InventoryMovementType.SALE_OUT)
					)
				);

			for (const movement of saleOutMovements) {
				const quantityToReturn = Math.abs(movement.quantityDelta);
				const updatedLot = await returnToLot(movement.lotId, quantityToReturn, tx);

				await createInventoryMovement(
					{
						movementType: InventoryMovementType.CANCEL_REVERT,
						lotId: movement.lotId,
						itemType: 'PRODUCT',
						productId: movement.productId!,
						quantityDelta: quantityToReturn,
						quantityBefore: updatedLot.quantityAvailable - quantityToReturn,
						quantityAfter: updatedLot.quantityAvailable,
						referenceType: MovementReferenceType.SALE,
						referenceId: data.id,
						createdById: context.userId!
					},
					tx
				);
			}

			// ── 2. Restore cached stock counters ────────────────────────────
			const oldItems = await tx
				.select()
				.from(saleItems)
				.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

			for (const item of oldItems) {
				if (item.productId) {
					const [product] = await tx
						.select({ id: products.id, stock: products.stock })
						.from(products)
						.where(eq(products.id, item.productId));

					if (product && product.stock !== null) {
						await tx
							.update(products)
							.set({ stock: product.stock + item.quantity, updatedAt: nowISO() })
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
							.set({ stock: lens.stock + item.quantity, updatedAt: nowISO() })
							.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
					}
				}
			}

			// ── 3. Soft-delete all existing sale items (cascade handles free_details + child treatments) ──
			await tx
				.update(saleItems)
				.set({ deletedAt: nowISO(), updatedAt: nowISO() })
				.where(and(eq(saleItems.saleId, data.id), isNull(saleItems.deletedAt)));

			// ── 4. Insert new items + consume inventory ──────────────────────
			const idMap = new Map<string, string>();
			const newIds = new Map<number, string>();
			data.items!.forEach((item, index) => {
				const newId = crypto.randomUUID();
				newIds.set(index, newId);
				if (item.id) idMap.set(item.id, newId);
			});
			for (const [index, item] of data.items!.entries()) {
				const saleItemId = newIds.get(index)!;
				const resolvedParentId = item.parentSaleItemId
					? (idMap.get(item.parentSaleItemId) ?? null)
					: null;

				let lotId: string | null = null;
				let snapshotCostTotal: number | null = null;
				let snapshotCostUnit: number | null = null;
				let snapshotLotsCount: number | null = null;

				if (item.itemType !== SaleItemType.FREE_ITEM) {
					({ lotId, snapshotCostTotal, snapshotCostUnit, snapshotLotsCount } =
						await consumeFifoForSaleItem(tx, data.id, item, context.userId!));
				}

				const lensSnapshotCosts = resolveLensSnapshotCosts(item);

				await tx.insert(saleItems).values({
					id: saleItemId,
					saleId: data.id,
					itemType: item.itemType,
					parentSaleItemId: resolvedParentId,
					productId: item.productId ?? null,
					lensCatalogItemId: item.lensCatalogItemId ?? null,
					supplierTreatmentId: item.supplierTreatmentId ?? null,
					lotId,
					prescriptionId: item.prescriptionId ?? null,
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
					shippingCostPending: item.shippingCostPending ?? false,
					notes: item.notes ?? null,
					createdAt: nowISO(),
					updatedAt: nowISO()
				});

				if (item.itemType === SaleItemType.FREE_ITEM) {
					await tx.insert(saleItemFreeDetails).values({
						id: crypto.randomUUID(),
						saleItemId,
						category: item.freeItemCategory!,
						description: item.freeItemDescription!,
						enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
						unitCost: item.freeItemUnitCost ?? null,
						supplierId: item.freeItemSupplierId ?? null,
						opticalNotes: item.freeItemOpticalNotes ?? null,
						createdAt: nowISO(),
						updatedAt: nowISO()
					});
				}
			}

			// ── 5. Recalculate tax snapshot if provided ─────────────────────
			const taxRate = data.snapshotTaxRate ?? existing.snapshotTaxRate;
			const updateData: Record<string, unknown> = {
				subtotal: newSubtotal,
				total: newTotal,
				snapshotTaxRate: taxRate,
				updatedAt: nowISO()
			};

			if (data.customerId) updateData.customerId = data.customerId;
			if (data.saleDate) updateData.saleDate = data.saleDate;
			if (data.notes !== undefined) updateData.notes = data.notes;
			if (data.discount !== undefined) updateData.discount = data.discount;
			if (data.discountType !== undefined) updateData.discountType = data.discountType;
			if (data.isCashea !== undefined) updateData.isCashea = data.isCashea;
			if (data.orderNumber !== undefined) updateData.orderNumber = data.orderNumber;

			const [updated] = await tx
				.update(sales)
				.set(updateData)
				.where(eq(sales.id, data.id))
				.returning();

			return updated;
		}

		// ── Header-only update (no item changes) ───────────────────────────
		const headerUpdate: Record<string, unknown> = {
			updatedAt: nowISO()
		};
		if (data.customerId) headerUpdate.customerId = data.customerId;
		if (data.saleDate) headerUpdate.saleDate = data.saleDate;
		if (data.notes !== undefined) headerUpdate.notes = data.notes;
		if (data.discount !== undefined) headerUpdate.discount = data.discount;
		if (data.discountType !== undefined) headerUpdate.discountType = data.discountType;
		if (data.snapshotTaxRate !== undefined) headerUpdate.snapshotTaxRate = data.snapshotTaxRate;
		if (data.isCashea !== undefined) headerUpdate.isCashea = data.isCashea;
		if (data.orderNumber !== undefined) headerUpdate.orderNumber = data.orderNumber;

		if (data.discount !== undefined || data.discountType !== undefined) {
			headerUpdate.subtotal = newSubtotal;
			headerUpdate.total = newTotal;
		}

		const [updated] = await tx
			.update(sales)
			.set(headerUpdate)
			.where(eq(sales.id, data.id))
			.returning();

		return updated;
	});

	if (!updatedSale) {
		return { success: false as const, error: 'Error al actualizar la venta' };
	}

	// Audit (best-effort, after transaction succeeds)
	await auditService.logUpdate(
		'sale',
		data.id,
		existing,
		updatedSale,
		{ ...context, reason: data.reason },
		{ excludeFields: ['createdAt', 'updatedAt', 'deletedAt'] }
	);

	return { success: true as const, sale: updatedSale };
});

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

/** Forward order used to decide whether a transition goes backwards. */
const SALE_STATUS_FLOW: SaleStatus[] = [
	SaleStatus.PENDING,
	SaleStatus.IN_PROGRESS,
	SaleStatus.READY,
	SaleStatus.COMPLETED
];

/**
 * Set the sale status (manual transition, forward or backward).
 * - Forward transitions (toward COMPLETED): any user that can manage the sale.
 * - Backward transitions (reverting): ADMIN/MANAGER only.
 * - completedAt is set when entering COMPLETED and cleared when leaving it.
 */
export const setSaleStatus = command(SetSaleStatusSchema, async (data) => {
	const user = requireAuth();
	const context = getAuditContext();

	const existing = await findSaleById(data.id);
	if (!existing) return { success: false as const, error: 'Venta no encontrada' };

	const targetStatus = data.status as SaleStatus;

	if (existing.status === SaleStatus.CANCELLED) {
		return {
			success: false as const,
			error: 'No se puede cambiar el estado de una venta cancelada'
		};
	}

	if (existing.status === targetStatus) {
		return { success: false as const, error: 'La venta ya está en ese estado' };
	}

	if (!canManageSaleByOwner(user.role, user.id, existing.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para modificar esta venta' };
	}

	const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;
	const currentIndex = SALE_STATUS_FLOW.indexOf(existing.status as SaleStatus);
	const targetIndex = SALE_STATUS_FLOW.indexOf(targetStatus);
	const isBackward = targetIndex < currentIndex;
	if (isBackward && !isAdmin) {
		return {
			success: false as const,
			error: 'Solo administradores pueden revertir el estado de una venta'
		};
	}

	if (isBackward && !data.reason?.trim()) {
		return {
			success: false as const,
			error: 'El motivo es obligatorio para revertir el estado'
		};
	}

	const updated = await db.transaction(async (tx) => {
		return updateSaleQuery(
			data.id,
			{
				status: targetStatus,
				completedAt: targetStatus === SaleStatus.COMPLETED ? nowISO() : null
			},
			tx
		);
	});

	if (!updated) {
		return { success: false as const, error: 'Error al actualizar la venta' };
	}

	await auditService.logUpdate(
		'sale',
		data.id,
		existing,
		updated,
		{ ...context, reason: data.reason?.trim() || undefined },
		{ excludeFields: ['createdAt', 'updatedAt', 'deletedAt'] }
	);

	return { success: true as const, sale: updated };
});

// ============================================================================
// ORDER NUMBER
// ============================================================================

/**
 * Get the next suggested order number (MAX + 1).
 * Used to reset the create-sale form suggestion after a manual override.
 */
export const getNextOrderNumberCommand = query(EmptySchema, async (): Promise<number> => {
	requireAuth();
	return getNextOrderNumber();
});
