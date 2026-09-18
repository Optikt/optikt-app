import { toSaleTotalsLine } from '$lib/remote/sales/helpers';
import { getNextOrderNumber } from '$lib/server/db/queries/sales/reads';
import {
	findCustomerById,
	findCustomerByIdNumber,
	createCustomer,
	createPrescription,
	unsetCurrentPrescriptions
} from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import { sales, type Customer, type Prescription } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { normalizeIdNumber } from '$lib/utils';
import { auditService } from '$lib/server/audit';
import { validateTreatmentItems } from '$lib/server/treatmentValidation';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { nowISO, composeBusinessTimestamp } from '$lib/dates';
import { toPrescriptionInsert } from '$lib/utils/prescription';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import { insertSaleItem } from '$lib/server/sales/saleItemInsert';
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

	const treatmentError = await validateTreatmentItems(data.items);
	if (treatmentError) {
		return { success: false as const, error: treatmentError.error };
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
		for (const item of data.items) {
			const saleItemId = item.id ?? crypto.randomUUID();

			const prescriptionId =
				item.itemType === SaleItemType.LENS_PAIR
					? (createdPrescription?.id ?? item.prescriptionId ?? null)
					: null;
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

		return { sale: newSale, newCustomer: createdCustomer, prescription: createdPrescription };
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
