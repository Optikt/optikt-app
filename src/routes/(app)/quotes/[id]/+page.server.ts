import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails,
	getQuoteConversionPreview,
	findQuoteById
} from '$lib/server/db/queries/quotes';
import { getEntityHistory } from '$lib/server/db/queries/changeHistory';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { sales } from '$lib/server/db/schema';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { findLensCatalogItemByIdWithRelations } from '$lib/server/db/queries/lenses/catalog';

/** Detalle de presupuesto: quote + ítems + preview de conversión + historial. */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const quote = await findQuoteByIdWithRelations(params.id);
	if (!quote) {
		error(404, 'Presupuesto no encontrado');
	}

	const [items, preview, auditHistory, sourceQuote, convertedSale] = await Promise.all([
		getQuoteItemsWithDetails(params.id),
		getQuoteConversionPreview(params.id),
		getEntityHistory('quote', params.id, { limit: 50 }),
		quote.sourceQuoteId ? findQuoteById(quote.sourceQuoteId) : Promise.resolve(null),
		quote.conversionSaleId
			? db
					.select({
						id: sales.id,
						orderNumber: sales.orderNumber,
						status: sales.status,
						total: sales.total,
						paidAmountBcvUsd: sales.paidAmountBcvUsd,
						createdAt: sales.createdAt
					})
					.from(sales)
					.where(eq(sales.id, quote.conversionSaleId))
					.limit(1)
			: Promise.resolve([])
	]);

	/** Catálogo de los cristales del presupuesto (tratamientos de fábrica en el meta). */
	const lensIds = [
		...new Set(
			items
				.filter((i) => i.itemType === SaleItemType.LENS_PAIR && i.lensCatalogItemId)
				.map((i) => i.lensCatalogItemId as string)
		)
	];
	const lensCatalogItems = (
		await Promise.all(lensIds.map((id) => findLensCatalogItemByIdWithRelations(id)))
	).filter((l) => l !== null);

	return {
		quote,
		items,
		preview,
		auditHistory,
		sourceQuoteNumber: sourceQuote?.quoteNumber ?? null,
		convertedSale: convertedSale[0] ?? null,
		lensCatalogItems
	};
};
