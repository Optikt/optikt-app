import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';
import {
	quotes,
	quoteItems,
	products,
	lensCatalogItems,
	supplierTreatments,
	type Quote
} from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import {
	buildQuoteConversionPreview,
	type QuoteConversionPreview,
	type QuoteConversionItemRow,
	type ConversionCatalogEntry
} from '$lib/shared/quotes/conversionPreview';
import { findQuoteById } from './reads';

/**
 * Marca un presupuesto como convertido CON guard de concurrencia:
 * `UPDATE ... WHERE id = ? AND status = 'DRAFT' RETURNING *`. Devuelve null si
 * el presupuesto ya no estaba en DRAFT (doble conversión ⇒ rollback de la tx).
 */
export async function markQuoteConverted(
	id: string,
	{ conversionSaleId, customerId }: { conversionSaleId: string; customerId?: string },
	executor: DbOrTx = db
): Promise<Quote | null> {
	const [quote] = await executor
		.update(quotes)
		.set({
			status: QuoteStatus.CONVERTED,
			conversionSaleId,
			...(customerId ? { customerId } : {}),
			updatedAt: nowISO()
		})
		.where(and(eq(quotes.id, id), eq(quotes.status, QuoteStatus.DRAFT)))
		.returning();
	return quote ?? null;
}

/**
 * Preview de conversión: stock y precio vigente por ítem + resumen.
 * Misma fuente para el hero del detalle y el modal de conversión.
 */
export async function getQuoteConversionPreview(
	quoteId: string
): Promise<QuoteConversionPreview | null> {
	const quote = await findQuoteById(quoteId);
	if (!quote) return null;

	const rows = await db
		.select({
			item: quoteItems,
			product: {
				id: products.id,
				name: products.name,
				currentSalePrice: products.currentSalePrice,
				stock: products.stock
			},
			lens: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				salePrice: lensCatalogItems.salePrice,
				pairPurchasePrice: lensCatalogItems.pairPurchasePrice,
				mountingPrice: lensCatalogItems.mountingPrice,
				shippingPrice: lensCatalogItems.shippingPrice,
				stock: lensCatalogItems.stock,
				inventoryMode: lensCatalogItems.inventoryMode
			},
			treatment: {
				id: supplierTreatments.id,
				name: supplierTreatments.name,
				price: supplierTreatments.price
			}
		})
		.from(quoteItems)
		.leftJoin(products, eq(quoteItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(quoteItems.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(supplierTreatments, eq(quoteItems.supplierTreatmentId, supplierTreatments.id))
		.where(and(eq(quoteItems.quoteId, quoteId), isNull(quoteItems.deletedAt)));

	const itemRows: QuoteConversionItemRow[] = rows.map((r) => ({
		item: r.item,
		label:
			r.item.snapshotName ??
			r.product?.name ??
			r.lens?.name ??
			r.treatment?.name ??
			'Ítem del presupuesto',
		product: r.product?.id
			? { currentSalePrice: r.product.currentSalePrice, stock: r.product.stock }
			: null,
		lens: r.lens?.id
			? {
					// El catálogo de lentes vende con `salePrice` (fallback = costo par);
					// el clasificador lo lee como `currentSalePrice`.
					currentSalePrice: r.lens.salePrice,
					pairPurchasePrice: r.lens.pairPurchasePrice,
					mountingPrice: r.lens.mountingPrice,
					shippingPrice: r.lens.shippingPrice,
					stock: r.lens.stock,
					inventoryMode: r.lens.inventoryMode
				}
			: null,
		treatment: r.treatment?.id
			? ({ currentSalePrice: r.treatment.price } satisfies ConversionCatalogEntry)
			: null
	}));

	return buildQuoteConversionPreview(itemRows, { hasCustomer: quote.customerId !== null });
}
