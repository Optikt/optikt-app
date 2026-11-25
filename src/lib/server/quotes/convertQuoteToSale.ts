import { toSaleTotalsLine, computeSaleTotals } from '$lib/shared/saleTotals';
import { findQuoteById, getQuoteItemsWithDetails } from '$lib/server/db/queries/quotes/reads';
import { markQuoteConverted } from '$lib/server/db/queries/quotes/conversion';
import { findCustomerById, resolveInlineCustomer } from '$lib/server/db/queries/customers';
import { findQuoteItemGroups } from '$lib/server/db/queries/quotes/itemGroups';
import { replaceSaleItemGroups, setSalePrimaryLens } from '$lib/server/db/queries/sales/itemGroups';
import {
	applyPrimaryPrescription,
	prescriptionFromLensLine
} from '$lib/server/sales/primaryPrescription';
import { defaultPrimaryLens, remapGroupItemIds } from '$lib/shared/saleItemGroups';
import { createSale } from '$lib/server/db/queries/sales/writes';
import { db } from '$lib/server/db';
import type { Customer, Prescription, Quote } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { SaleStatus } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { auditService } from '$lib/server/audit';
import { toISODate, nowUTC, nowISO } from '$lib/dates';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';
import { insertSaleItem } from '$lib/server/sales/saleItemInsert';
import type { ConvertQuoteInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

/** Error con mensaje de usuario: corta la tx y sube el mensaje al remote. */
class ConversionError extends Error {}

/**
 * Convert a DRAFT quote to a sale.
 *
 * D5 (presupuesto sin cliente): el cliente puede venir como `customerId`
 * existente o como `newCustomer` inline — se crea DENTRO de la transacción y
 * queda asignado al presupuesto Y a la venta en la misma tx. Sin cliente en
 * ninguna de las tres vías se rechaza.
 *
 * D8: la política de stock es exactamente la de crear una venta nueva hoy
 * (`insertSaleItem` → `consumeFifoForSaleItem`); stock insuficiente lanza y
 * revierte todo. El precio de catálogo NO se actualiza: se respeta el
 * presupuestado (D8).
 *
 * D4: `isCashea` se copia del presupuesto salvo override explícito del modal.
 *
 * Guard de concurrencia (D8/D11): el estado se cambia con
 * `markQuoteConverted` (`UPDATE ... WHERE status='DRAFT' RETURNING *`) al
 * final de la tx — dos conversiones simultáneas nunca crean dos ventas.
 */
export async function convertQuoteToSaleCore(data: ConvertQuoteInput, ctx: ActionContext) {
	// Validación de lectura, fuera de la tx
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

	const [items, quoteGroups] = await Promise.all([
		getQuoteItemsWithDetails(data.id),
		findQuoteItemGroups(data.id)
	]);
	if (items.length === 0) {
		return { success: false as const, error: 'El presupuesto no tiene ítems' };
	}

	// ── Resolver el cliente ───────────────────────────────────────────────
	// customerId existente y el heredado del presupuesto se validan aquí
	// (lecturas); el cliente nuevo inline se crea dentro de la tx.
	let customerId: string | null = null;
	let createdCustomer: Customer | null = null;

	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { success: false as const, error: 'Cliente no encontrado' };
		}
		customerId = customer.id;
	} else if (quote.customerId) {
		const customer = await findCustomerById(quote.customerId);
		if (!customer) {
			return { success: false as const, error: 'Cliente del presupuesto no encontrado' };
		}
		customerId = customer.id;
	}

	// Recomputed totals — never copy quote.subtotal/quote.total (pre-tax semantics)
	const totals = computeSaleTotals(
		items.map((item) => toSaleTotalsLine(item, quote.snapshotTaxRate)),
		quote.discount,
		quote.discountType
	);

	// Build a map of quote item IDs → new sale item IDs (treatment parents + groups)
	const idMap = new Map<string, string>();
	for (const item of items) {
		idMap.set(item.id, crypto.randomUUID());
	}

	// "Fórmula del cliente": chosen in the modal (null = "Ninguna"); absent →
	// default rule (exactly one lens and no names). Replaces the old
	// `firstDefined` derivation over every lens (multi-person debt).
	const primaryQuoteItemId =
		data.primaryQuoteItemId !== undefined
			? data.primaryQuoteItemId
			: defaultPrimaryLens(
					items.map((item) => ({ ...item, parentId: item.parentQuoteItemId })),
					quoteGroups
				);
	const primaryQuoteItem = primaryQuoteItemId
		? items.find((i) => i.id === primaryQuoteItemId && i.itemType === SaleItemType.LENS_PAIR)
		: undefined;
	if (primaryQuoteItemId && !primaryQuoteItem) {
		return {
			success: false as const,
			error: 'La fórmula elegida no es un cristal del presupuesto'
		};
	}

	// Freeze the live USD BCV rate for future tickera reprints (null when API down)
	const liveBcvRate = await getExchangeRateValue('USD');
	const snapshotBcvRate = liveBcvRate !== null && liveBcvRate > 0 ? liveBcvRate : null;

	let sale!: Awaited<ReturnType<typeof createSale>>;
	let createdPrescription: Prescription | null = null;
	let finalQuote: Quote | null = null;

	try {
		await db.transaction(async (tx) => {
			// Cliente nuevo inline: se crea dentro de la tx (cédula duplicada ⇒ rollback)
			if (!customerId && data.newCustomer) {
				const result = await resolveInlineCustomer(data.newCustomer, tx);
				if ('error' in result) {
					throw new ConversionError(result.error);
				}
				customerId = result.customer.id;
				createdCustomer = result.customer;
			}
			if (!customerId) {
				throw new ConversionError('Selecciona o registra al cliente para convertir');
			}

			const now = nowISO();

			// Create the sale via the query function (no Drizzle inline).
			// El número lo asigna la sequence `sales_order_number_seq`.
			// `createdAt` la fija createSale (= now del submit, fecha-verdad).
			sale = await createSale(
				{
					customerId,
					sellerId: ctx.userId!,
					status: SaleStatus.PENDING,
					subtotal: totals.subtotal,
					discount: quote.discount,
					discountType: quote.discountType,
					snapshotTaxRate: quote.snapshotTaxRate,
					/** Frozen USD BCV rate for tickera reprints */
					snapshotBcvRate,
					total: totals.total,
					paidAmountBcvUsd: 0,
					isCashea: data.isCashea ?? quote.isCashea,
					notes: quote.notes ?? null
				},
				tx
			);

			// Create sale items from quote items + handle stock via FIFO
			for (const item of items) {
				const newId = idMap.get(item.id)!;
				const parentSaleItemId = item.parentQuoteItemId
					? (idMap.get(item.parentQuoteItemId) ?? null)
					: null;

				await insertSaleItem(tx, {
					id: newId,
					saleId: sale.id,
					item,
					parentSaleItemId,
					prescriptionId: null,
					userId: ctx.userId!,
					now
				});
			}

			if (quoteGroups.length > 0) {
				await replaceSaleItemGroups(sale.id, remapGroupItemIds(quoteGroups, idMap), tx);
			}

			// Only the chosen lens becomes the customer's current Rx (and is the
			// only lens linked to it). "Ninguna" → nothing is created/overwritten.
			if (primaryQuoteItem) {
				const saleLensId = idMap.get(primaryQuoteItem.id)!;
				await setSalePrimaryLens(sale.id, saleLensId, tx);
				sale = { ...sale, primaryLensItemId: saleLensId };
				const fields = prescriptionFromLensLine(
					primaryQuoteItem,
					toISODate(nowUTC()),
					primaryQuoteItem.lensCatalogItem?.type
				);
				if (fields) {
					createdPrescription = await applyPrimaryPrescription(tx, {
						customerId,
						saleItemId: saleLensId,
						fields
					});
				}
			}

			// Guard de concurrencia: solo transiciona si sigue DRAFT.
			// 0 filas ⇒ alguien más ya convirtió o canceló ⇒ rollback total.
			finalQuote = await markQuoteConverted(
				data.id,
				{
					conversionSaleId: sale.id,
					customerId: customerId !== quote.customerId ? customerId : undefined
				},
				tx
			);
			if (!finalQuote) {
				throw new ConversionError('Este presupuesto ya fue convertido o cancelado');
			}
		});
	} catch (error) {
		if (error instanceof ConversionError) {
			return { success: false as const, error: error.message };
		}
		throw error;
	}

	// Audit logs (best-effort, after transaction succeeds)
	if (createdCustomer) {
		await auditService.logCreate('customer', createdCustomer, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}
	if (createdPrescription) {
		await auditService.logCreate('prescription', createdPrescription, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	await auditService.logCreate('sale', sale, ctx, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	if (finalQuote) {
		await auditService.logUpdate('quote', data.id, quote, finalQuote, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	return { success: true as const, sale };
}
