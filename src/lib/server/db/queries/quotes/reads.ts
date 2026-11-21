import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	customers,
	lensCatalogItems,
	products,
	quotes,
	quoteItems,
	quoteItemFreeDetails,
	sales,
	supplierTreatments,
	users
} from '$lib/server/db/schema';
import type { Quote, QuoteWithRelations, QuoteItemWithDetails } from './types';

/** Find a quote by ID. */
export async function findQuoteById(
	id: string,
	{ deleted }: { deleted?: boolean } = {},
	executor: DbOrTx = db
): Promise<Quote | null> {
	const filter = deleted ? eq(quotes.id, id) : and(eq(quotes.id, id), isNull(quotes.deletedAt));
	const [quote] = await executor.select().from(quotes).where(filter!);
	return quote ?? null;
}

/** Find a single quote by ID with customer/seller relations and sale number. */
export async function findQuoteByIdWithRelations(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<QuoteWithRelations | null> {
	const filter = deleted ? eq(quotes.id, id) : and(eq(quotes.id, id), isNull(quotes.deletedAt));

	const [result] = await db
		.select({
			quote: quotes,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber,
				birthDate: customers.birthDate,
				primaryPhone: customers.primaryPhone,
				gender: customers.gender,
				address: customers.address
			},
			seller: { id: users.id, fullName: users.fullName },
			convertedOrderNumber: sales.orderNumber
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.where(filter!);

	if (!result) return null;
	return {
		...result.quote,
		customer: result.customer?.id ? result.customer : null,
		seller: result.seller?.id ? result.seller : null,
		convertedOrderNumber: result.convertedOrderNumber ?? null
	};
}

/** Quote items con producto/lente/tratamiento y detalle libre. */
export async function getQuoteItemsWithDetails(quoteId: string): Promise<QuoteItemWithDetails[]> {
	const results = await db
		.select({
			item: quoteItems,
			product: {
				id: products.id,
				name: products.name,
				sku: products.sku,
				type: products.type
			},
			lensCatalogItem: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				type: lensCatalogItems.type
			},
			supplierTreatments: {
				id: supplierTreatments.id,
				name: supplierTreatments.name,
				category: supplierTreatments.category
			},
			freeDetails: quoteItemFreeDetails
		})
		.from(quoteItems)
		.leftJoin(products, eq(quoteItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(quoteItems.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(supplierTreatments, eq(quoteItems.supplierTreatmentId, supplierTreatments.id))
		.leftJoin(quoteItemFreeDetails, eq(quoteItems.id, quoteItemFreeDetails.quoteItemId))
		.where(and(eq(quoteItems.quoteId, quoteId), isNull(quoteItems.deletedAt)));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null,
		lensCatalogItem: r.lensCatalogItem?.id ? r.lensCatalogItem : null,
		supplierTreatment: r.supplierTreatments?.id ? r.supplierTreatments : null,
		freeDetails: r.freeDetails?.id ? r.freeDetails : null
	}));
}
