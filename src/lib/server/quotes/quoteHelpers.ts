/**
 * Quote helpers del servidor — builders puros compartidos por los cores de
 * quotes. Antes vivían en `$lib/remote/quotes/helpers` (inversión de capas,
 * deuda resuelta en el plan quotes-redesign).
 */

import type { QuoteItemInput } from '$lib/schemas/quotes';

import { saleItemCommonValues } from '$lib/shared/saleItemValues';

export function buildQuoteItemValues(item: QuoteItemInput, quoteId: string, now: string) {
	return {
		id: item.id ?? crypto.randomUUID(),
		quoteId,
		parentQuoteItemId: item.parentQuoteItemId ?? null,
		...saleItemCommonValues(item),
		createdAt: now,
		updatedAt: now
	};
}
