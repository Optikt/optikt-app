import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails,
	findQuoteById
} from '$lib/server/db/queries/quotes/reads';
import { getQuoteConversionPreview } from '$lib/server/db/queries/quotes/conversion';
import { findConvertedSaleSummaryById } from '$lib/server/db/queries/sales/reads';
import { getEntityHistory } from '$lib/server/db/queries/changeHistory';
import { getAllTreatments } from '$lib/server/db/queries/suppliers';
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

	const [items, preview, auditHistory, sourceQuote, convertedSale, allTreatments] =
		await Promise.all([
			getQuoteItemsWithDetails(params.id),
			getQuoteConversionPreview(params.id),
			getEntityHistory('quote', params.id, { limit: 50 }),
			quote.sourceQuoteId ? findQuoteById(quote.sourceQuoteId) : Promise.resolve(null),
			quote.conversionSaleId
				? findConvertedSaleSummaryById(quote.conversionSaleId)
				: Promise.resolve(null),
			// Igual que /sales/[id]: el drawer de edición necesita el catálogo de tratamientos.
			getAllTreatments()
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
		convertedSale,
		allTreatments,
		lensCatalogItems
	};
};
