import { toSaleTotalsLine, computeSaleTotals } from '$lib/shared/saleTotals';
import { findQuoteById, getQuoteItemsWithDetails } from '$lib/server/db/queries/quotes/reads';
import { markQuoteConverted } from '$lib/server/db/queries/quotes/conversion';
import { findCustomerById, resolveInlineCustomer } from '$lib/server/db/queries/customers';
import { findQuoteItemGroups, lockQuoteForGroups } from '$lib/server/db/queries/quotes/itemGroups';
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
	// Pre-checks rápidos (fuera de tx); la lectura autoritativa ocurre tras el lock en tx.
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

	if (data.customerId) {
		const customer = await findCustomerById(data.customerId);
		if (!customer) {
			return { success: false as const, error: 'Cliente no encontrado' };
		}
	}

	// Freeze the live USD BCV rate before entering the transaction lock.
	const liveBcvRate = await getExchangeRateValue('USD');
	const snapshotBcvRate = liveBcvRate !== null && liveBcvRate > 0 ? liveBcvRate : null;

	let sale!: Awaited<ReturnType<typeof createSale>>;
	let createdCustomer: Customer | null = null;
	let createdPrescription: Prescription | null = null;
	let beforeQuote: Quote = quote;
	let finalQuote: Quote | null = null;

	try {
		await db.transaction(async (tx) => {
			const locked = await lockQuoteForGroups(data.id, tx);
			if (!locked) {
				throw new ConversionError('Presupuesto no encontrado');
			}
			if (locked.status !== QuoteStatus.DRAFT) {
				throw new ConversionError('Este presupuesto ya fue convertido o cancelado');
			}

			const [freshQuote, items, quoteGroups] = await Promise.all([
				findQuoteById(data.id, {}, tx),
				getQuoteItemsWithDetails(data.id, tx),
				findQuoteItemGroups(data.id, tx)
			]);
			if (!freshQuote || freshQuote.status !== QuoteStatus.DRAFT) {
				throw new ConversionError('Este presupuesto ya fue convertido o cancelado');
			}
			if (items.length === 0) {
				throw new ConversionError('El presupuesto no tiene ítems');
			}
			beforeQuote = freshQuote;

			// Resolver cliente: data.customerId, heredado del quote bloqueado o newCustomer inline.
			let customerId: string | null = data.customerId ?? null;
			if (!customerId && freshQuote.customerId) {
				const inherited = await findCustomerById(freshQuote.customerId, { executor: tx });
				if (!inherited) {
					throw new ConversionError('Cliente del presupuesto no encontrado');
				}
				customerId = inherited.id;
			}
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

			// Recomputed totals — never copy quote.subtotal/quote.total (pre-tax semantics)
			const totals = computeSaleTotals(
				items.map((item) => toSaleTotalsLine(item, freshQuote.snapshotTaxRate)),
				freshQuote.discount,
				freshQuote.discountType
			);

			const idMap = new Map<string, string>();
			const orderedItems = [
				...items.filter((i) => !i.parentQuoteItemId),
				...items.filter((i) => !!i.parentQuoteItemId)
			];
			for (const item of orderedItems) {
				idMap.set(item.id, crypto.randomUUID());
			}

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
				throw new ConversionError('La fórmula elegida no es un cristal del presupuesto');
			}

			const now = nowISO();

			sale = await createSale(
				{
					customerId,
					sellerId: ctx.userId!,
					status: SaleStatus.PENDING,
					subtotal: totals.subtotal,
					discount: freshQuote.discount,
					discountType: freshQuote.discountType,
					snapshotTaxRate: freshQuote.snapshotTaxRate,
					/** Frozen USD BCV rate for tickera reprints */
					snapshotBcvRate,
					total: totals.total,
					paidAmountBcvUsd: 0,
					isCashea: data.isCashea ?? freshQuote.isCashea,
					notes: freshQuote.notes ?? null
				},
				tx
			);

			for (const item of orderedItems) {
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

			finalQuote = await markQuoteConverted(
				data.id,
				{
					conversionSaleId: sale.id,
					customerId: customerId !== freshQuote.customerId ? customerId : undefined
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
		await auditService.logUpdate('quote', data.id, beforeQuote, finalQuote, ctx, {
			excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
		});
	}

	return { success: true as const, sale };
}
