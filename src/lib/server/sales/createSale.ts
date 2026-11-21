import { getNextOrderNumber } from '$lib/server/db/queries/sales/reads';
import { db } from '$lib/server/db';
import { sales, type Customer, type Prescription } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { auditService } from '$lib/server/audit';
import { validateTreatmentItems } from '$lib/server/treatmentValidation';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { nowISO, composeBusinessTimestamp } from '$lib/dates';
import { replaceSaleItemGroups, setSalePrimaryLens } from '$lib/server/db/queries/sales/itemGroups';
import { applyPrimaryPrescription } from '$lib/server/sales/primaryPrescription';
import { defaultPrimaryLens, normalizeGroupsForSubmit } from '$lib/shared/saleItemGroups';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import { insertSaleItem } from '$lib/server/sales/saleItemInsert';
import { computeDocumentTotals } from '$lib/server/documentTotals';
import { createInlineCustomer, resolveCustomerReference } from '$lib/server/customerReference';
import type { CreateSaleInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Create a new sale with items in a single transaction.
 * Persists items with prescriptions and decrements product stock.
 */
export async function createSaleCore(data: CreateSaleInput, ctx: ActionContext) {
	// Only ADMIN can assign a custom order number (backfill historical sales).
	if (data.orderNumber && ctx.role !== UserRole.ADMIN) {
		return {
			success: false as const,
			error: 'Solo administradores pueden asignar un número de orden'
		};
	}

	// Validate customer reference (reads only - safe outside transaction)
	const customerResolution = await resolveCustomerReference(data);
	if ('error' in customerResolution) {
		return { success: false as const, error: customerResolution.error };
	}
	if (!customerResolution.customerId && !data.newCustomer) {
		return { success: false as const, error: 'Debe seleccionar o crear un cliente' };
	}
	const existingCustomerId = customerResolution.customerId;

	const treatmentError = await validateTreatmentItems(data.items);
	if (treatmentError) {
		return { success: false as const, error: treatmentError.error };
	}

	// Calculate totals from items (pure computation - safe outside transaction)
	const totals = computeDocumentTotals(
		data.items,
		data.discount,
		data.discountType,
		data.snapshotTaxRate ?? DEFAULT_TAX_RATE
	);
	const subtotal = totals.subtotal;
	const total = totals.total;

	// Client ids are kept as real ids on create (`item.id ?? random`), so group
	// members and the primary lens need no translation here.
	const itemIds = data.items.map((item) => item.id ?? crypto.randomUUID());
	const groups = normalizeGroupsForSubmit(data.groups ?? []);

	// Primary lens ("fórmula principal"): explicit value wins; absent (legacy
	// callers) falls back to the default rule (exactly one lens, no names).
	const primaryLensItemId =
		data.primaryLensItemId !== undefined
			? data.primaryLensItemId
			: defaultPrimaryLens(
					data.items
						.map((item, index) => ({ ...item, id: itemIds[index] }))
						.filter((item) => item.itemType === SaleItemType.LENS_PAIR),
					groups
				);

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
			createdCustomer = await createInlineCustomer(data.newCustomer!, tx);
			customerId = createdCustomer.id;
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
				sellerId: ctx.userId!,
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
		for (const [index, item] of data.items.entries()) {
			const saleItemId = itemIds[index];

			// Each lens keeps its own link; only the primary lens is re-linked
			// below to the customer's new current prescription.
			const prescriptionId =
				item.itemType === SaleItemType.LENS_PAIR ? (item.prescriptionId ?? null) : null;
			await insertSaleItem(tx, {
				id: saleItemId,
				saleId: newSale.id,
				item,
				parentSaleItemId: item.parentSaleItemId ?? null,
				prescriptionId,
				userId: ctx.userId!,
				now
			});
		}

		if (groups.length > 0) {
			await replaceSaleItemGroups(newSale.id, groups, tx);
		}

		// Only the primary lens stamps the customer's current Rx. Without a
		// primary (multi-person sale, or "Ninguna") nothing is created/overwritten.
		let saleRow = newSale;
		if (primaryLensItemId) {
			await setSalePrimaryLens(newSale.id, primaryLensItemId, tx);
			saleRow = { ...newSale, primaryLensItemId };
			if (data.prescription) {
				createdPrescription = await applyPrimaryPrescription(tx, {
					customerId,
					saleItemId: primaryLensItemId,
					fields: data.prescription
				});
			}
		}

		return { sale: saleRow, newCustomer: createdCustomer, prescription: createdPrescription };
	});

	// Audit logs (best-effort, after transaction succeeds)
	if (newCustomer) {
		await auditService.logCreate('customer', newCustomer, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

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
