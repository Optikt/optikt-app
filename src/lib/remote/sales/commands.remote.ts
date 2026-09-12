/**
 * Sales remote — create command
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { resolveLensSnapshotCosts, toSaleTotalsLine } from './shared';
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { CreateSaleSchema } from '$lib/schemas/sales';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';

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
	type Customer,
	type Prescription
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';

import { normalizeIdNumber } from '$lib/utils';
import { auditService, getAuditContext } from '$lib/server/audit';
import { findLensCatalogItemById } from '$lib/server/db/queries/lenses';
import { findSupplierTreatmentById } from '$lib/server/db/queries/suppliers';

import { consumeFifoForSaleItem } from '$lib/server/db/queries/fifoConsumption';

import { getExchangeRateValue } from '$lib/server/exchangeRates/service';

import { nowISO, composeBusinessTimestamp } from '$lib/dates';

import { toPrescriptionInsert } from '$lib/utils/prescription';

import { computeSaleTotals } from '$lib/shared/saleTotals';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

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

	// Freeze the live USD BCV rate for future tickera reprints (null when API down — print falls back to live)
	const liveBcvRate = await getExchangeRateValue('USD');
	const snapshotBcvRate = liveBcvRate !== null && liveBcvRate > 0 ? liveBcvRate : null;

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
				/** saleDate alias → createdAt (single date truth): form day + submit time, Caracas */
				createdAt: composeBusinessTimestamp(data.saleDate),
				status: SaleStatus.PENDING,
				subtotal,
				discount: data.discount,
				discountType: data.discountType,
				snapshotTaxRate: data.snapshotTaxRate,
				/** Frozen USD BCV rate for tickera reprints */
				snapshotBcvRate,
				total,
				paidAmountBcvUsd: 0,
				isCashea: data.isCashea ?? false,
				notes: data.notes ?? null,
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
