import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses/catalog';
import { getQuoteNumberPreview } from '$lib/server/db/queries/quotes/list';
import {
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails
} from '$lib/server/db/queries/quotes/reads';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

/** Wizard de nuevo presupuesto — `?from=<id>` precarga el duplicado (D7). */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const fromId = url.searchParams.get('from');

	const [products, lensItems, nextQuoteNumber, suppliers, fromQuote] = await Promise.all([
		getAllProductsWithRelations({ orderBy: 'name' }),
		getLensCatalogItemsWithRelations(),
		getQuoteNumberPreview(),
		getAllSuppliers({ orderBy: 'name' }),
		fromId
			? (async () => {
					const quote = await findQuoteByIdWithRelations(fromId);
					if (!quote) return null;
					const items = await getQuoteItemsWithDetails(fromId);
					return { quote, items };
				})()
			: Promise.resolve(null)
	]);

	return {
		products,
		lensItems,
		suppliers,
		nextQuoteNumber,
		fromQuote
	};
};
