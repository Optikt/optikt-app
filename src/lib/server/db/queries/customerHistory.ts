import { eq, isNull, and, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	sales,
	saleItems,
	salePayments,
	quotes,
	quoteItems,
	users,
	products,
	lensCatalogItems,
	supplierTreatments,
	saleItemFreeDetails,
	quoteItemFreeDetails,
	type SalePayment
} from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

/** A sale item summary for the customer history view */
export interface HistorySaleItem {
	id: string;
	itemType: string;
	snapshotName: string | null;
	snapshotSku: string | null;
	snapshotBrand: string | null;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: string;
	/** Resolved display name from product/lens/treatment joins */
	displayName: string;
}

/** A sale in the customer history */
export interface HistorySale {
	id: string;
	orderNumber: number;
	saleDate: string;
	status: string;
	subtotal: number;
	discount: number;
	discountType: string;
	total: number;
	paidAmountBcvUsd: number;
	notes: string | null;
	seller: { id: string; fullName: string } | null;
	items: HistorySaleItem[];
	payments: HistoryPayment[];
}

/** A payment in the customer history */
export interface HistoryPayment {
	id: string;
	paymentMethod: string;
	amount: number;
	amountBcvUsd: number;
	paymentDate: string;
	reference: string | null;
}

/** A quote item summary for the customer history view */
export interface HistoryQuoteItem {
	id: string;
	itemType: string;
	snapshotName: string | null;
	snapshotSku: string | null;
	snapshotBrand: string | null;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: string;
	displayName: string;
}

/** A quote in the customer history */
export interface HistoryQuote {
	id: string;
	quoteNumber: number;
	quoteDate: string;
	status: string;
	subtotal: number;
	discount: number;
	discountType: string;
	total: number;
	conversionSaleId: string | null;
	validUntil: string | null;
	notes: string | null;
	seller: { id: string; fullName: string } | null;
	items: HistoryQuoteItem[];
}

/** Complete customer history */
export interface CustomerHistory {
	sales: HistorySale[];
	quotes: HistoryQuote[];
}

// ============================================================================
// QUERY
// ============================================================================

/**
 * Get the complete history for a customer: all sales with items/payments
 * and all quotes with items.
 *
 * Results are ordered by date descending (most recent first).
 */
export async function getCustomerHistory(customerId: string): Promise<CustomerHistory> {
	// ── Sales with seller ─────────────────────────────────────────────
	const salesRows = await db
		.select({
			sale: sales,
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(sales)
		.leftJoin(users, eq(sales.sellerId, users.id))
		.where(and(eq(sales.customerId, customerId), isNull(sales.deletedAt)))
		.orderBy(desc(sales.saleDate));

	const saleIds = salesRows.map((r) => r.sale.id);

	// ── Sale items (batch) ────────────────────────────────────────────
	let saleItemRows: {
		item: typeof saleItems.$inferSelect;
		productName: string | null;
		lensName: string | null;
		treatmentName: string | null;
		freeDescription: string | null;
	}[] = [];

	if (saleIds.length > 0) {
		const rawItems = await db
			.select({
				item: saleItems,
				productName: products.name,
				lensName: lensCatalogItems.name,
				treatmentName: supplierTreatments.name,
				freeDescription: saleItemFreeDetails.description
			})
			.from(saleItems)
			.leftJoin(products, eq(saleItems.productId, products.id))
			.leftJoin(lensCatalogItems, eq(saleItems.lensCatalogItemId, lensCatalogItems.id))
			.leftJoin(supplierTreatments, eq(saleItems.supplierTreatmentId, supplierTreatments.id))
			.leftJoin(saleItemFreeDetails, eq(saleItems.id, saleItemFreeDetails.saleItemId))
			.where(
				and(
					eq(saleItems.saleId, saleIds.length === 1 ? saleIds[0] : saleItems.saleId),
					isNull(saleItems.deletedAt)
				)
			);

		// Filter to only items belonging to our sales
		saleItemRows =
			saleIds.length === 1 ? rawItems : rawItems.filter((r) => saleIds.includes(r.item.saleId));
	}

	// ── Sale payments (batch) ─────────────────────────────────────────
	let allPayments: SalePayment[] = [];
	if (saleIds.length > 0) {
		allPayments = await db
			.select()
			.from(salePayments)
			.where(isNull(salePayments.voidedAt))
			.orderBy(desc(salePayments.paymentDate));

		// Filter to only payments for our sales
		allPayments = allPayments.filter((p) => saleIds.includes(p.saleId));
	}

	// ── Group items and payments by saleId ─────────────────────────────
	const itemsBySale = new Map<string, HistorySaleItem[]>();
	for (const row of saleItemRows) {
		const saleId = row.item.saleId;
		if (!itemsBySale.has(saleId)) itemsBySale.set(saleId, []);
		itemsBySale.get(saleId)!.push({
			id: row.item.id,
			itemType: row.item.itemType,
			snapshotName: row.item.snapshotName,
			snapshotSku: row.item.snapshotSku,
			snapshotBrand: row.item.snapshotBrand,
			quantity: row.item.quantity,
			unitPrice: row.item.unitPrice,
			discount: row.item.discount,
			discountType: row.item.discountType,
			displayName:
				row.item.snapshotName ??
				row.productName ??
				row.lensName ??
				row.treatmentName ??
				row.freeDescription ??
				'Ítem'
		});
	}

	const paymentsBySale = new Map<string, HistoryPayment[]>();
	for (const p of allPayments) {
		if (!paymentsBySale.has(p.saleId)) paymentsBySale.set(p.saleId, []);
		paymentsBySale.get(p.saleId)!.push({
			id: p.id,
			paymentMethod: p.paymentMethod,
			amount: p.amount,
			amountBcvUsd: p.amountBcvUsd,
			paymentDate: p.paymentDate,
			reference: p.reference
		});
	}

	// ── Assemble sales ────────────────────────────────────────────────
	const historySales: HistorySale[] = salesRows.map((r) => ({
		id: r.sale.id,
		orderNumber: r.sale.orderNumber,
		saleDate: r.sale.saleDate,
		status: r.sale.status,
		subtotal: r.sale.subtotal,
		discount: r.sale.discount,
		discountType: r.sale.discountType,
		total: r.sale.total,
		paidAmountBcvUsd: r.sale.paidAmountBcvUsd,
		notes: r.sale.notes,
		seller: r.seller?.id ? r.seller : null,
		items: itemsBySale.get(r.sale.id) ?? [],
		payments: paymentsBySale.get(r.sale.id) ?? []
	}));

	// ── Quotes with seller ────────────────────────────────────────────
	const quoteRows = await db
		.select({
			quote: quotes,
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(quotes)
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.where(and(eq(quotes.customerId, customerId), isNull(quotes.deletedAt)))
		.orderBy(desc(quotes.quoteDate));

	const quoteIds = quoteRows.map((r) => r.quote.id);

	// ── Quote items (batch) ───────────────────────────────────────────
	let quoteItemRows: {
		item: typeof quoteItems.$inferSelect;
		productName: string | null;
		lensName: string | null;
		treatmentName: string | null;
		freeDescription: string | null;
	}[] = [];

	if (quoteIds.length > 0) {
		const rawQItems = await db
			.select({
				item: quoteItems,
				productName: products.name,
				lensName: lensCatalogItems.name,
				treatmentName: supplierTreatments.name,
				freeDescription: quoteItemFreeDetails.description
			})
			.from(quoteItems)
			.leftJoin(products, eq(quoteItems.productId, products.id))
			.leftJoin(lensCatalogItems, eq(quoteItems.lensCatalogItemId, lensCatalogItems.id))
			.leftJoin(supplierTreatments, eq(quoteItems.supplierTreatmentId, supplierTreatments.id))
			.leftJoin(quoteItemFreeDetails, eq(quoteItems.id, quoteItemFreeDetails.quoteItemId))
			.where(
				and(
					eq(quoteItems.quoteId, quoteIds.length === 1 ? quoteIds[0] : quoteItems.quoteId),
					isNull(quoteItems.deletedAt)
				)
			);

		quoteItemRows =
			quoteIds.length === 1
				? rawQItems
				: rawQItems.filter((r) => quoteIds.includes(r.item.quoteId));
	}

	// ── Group quote items ─────────────────────────────────────────────
	const itemsByQuote = new Map<string, HistoryQuoteItem[]>();
	for (const row of quoteItemRows) {
		const quoteId = row.item.quoteId;
		if (!itemsByQuote.has(quoteId)) itemsByQuote.set(quoteId, []);
		itemsByQuote.get(quoteId)!.push({
			id: row.item.id,
			itemType: row.item.itemType,
			snapshotName: row.item.snapshotName,
			snapshotSku: row.item.snapshotSku,
			snapshotBrand: row.item.snapshotBrand,
			quantity: row.item.quantity,
			unitPrice: row.item.unitPrice,
			discount: row.item.discount,
			discountType: row.item.discountType,
			displayName:
				row.item.snapshotName ??
				row.productName ??
				row.lensName ??
				row.treatmentName ??
				row.freeDescription ??
				'Ítem'
		});
	}

	// ── Assemble quotes ───────────────────────────────────────────────
	const historyQuotes: HistoryQuote[] = quoteRows.map((r) => ({
		id: r.quote.id,
		quoteNumber: r.quote.quoteNumber,
		quoteDate: r.quote.quoteDate,
		status: r.quote.status,
		subtotal: r.quote.subtotal,
		discount: r.quote.discount,
		discountType: r.quote.discountType,
		total: r.quote.total,
		conversionSaleId: r.quote.conversionSaleId,
		validUntil: r.quote.validUntil,
		notes: r.quote.notes,
		seller: r.seller?.id ? r.seller : null,
		items: itemsByQuote.get(r.quote.id) ?? []
	}));

	return {
		sales: historySales,
		quotes: historyQuotes
	};
}
